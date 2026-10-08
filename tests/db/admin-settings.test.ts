import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createCustomer, deleteUsers, type TestClient, testAddress } from "./helpers";
import { addToCart, createOrder, restoreStock, type StockedVariant, stockVariants } from "./order-helpers";

// M10: owner-only coupon and settings writes, and account deletion processing.

const admin = adminClient();
const users: string[] = [];
const couponIds: string[] = [];
let owner: TestClient;
let staff: TestClient;
let variants: StockedVariant[] = [];

const code = (s: string) => `T${randomUUID().slice(0, 8).toUpperCase()}-${s}`;

beforeAll(async () => {
  const o = await createCustomer();
  const s = await createCustomer();
  users.push(o.id, s.id);
  owner = o.client;
  staff = s.client;
  await admin.from("profiles").update({ role: "owner" }).eq("id", o.id);
  await admin.from("profiles").update({ role: "staff" }).eq("id", s.id);
  variants = await stockVariants(1, 20, 30);
});

afterAll(async () => {
  await admin.from("coupons").delete().in("id", couponIds);
  await restoreStock(variants);
  await deleteUsers(...users);
});

describe("coupons", () => {
  it("lets the owner create and edit coupons", async () => {
    const { data, error } = await owner
      .from("coupons")
      .insert({ code: code("OWN"), kind: "percent", value: 10 })
      .select("id")
      .single();
    expect(error).toBeNull();
    couponIds.push(data!.id);
    const update = await owner.from("coupons").update({ value: 15 }).eq("id", data!.id).select("value").single();
    expect(update.data?.value).toBe(15);
  });

  it("lets staff read but not write coupons", async () => {
    const insert = await staff.from("coupons").insert({ code: code("STF"), kind: "flat", value: 5000 });
    expect(insert.error).not.toBeNull();

    const { data } = await staff.from("coupons").select("id, value").eq("id", couponIds[0]).single();
    expect(data?.value).toBe(15);
    const update = await staff.from("coupons").update({ value: 90 }).eq("id", couponIds[0]).select("id");
    expect(update.data ?? []).toHaveLength(0);
  });

  it("never lets anyone set the redemption counter", async () => {
    const insert = await owner.from("coupons").insert({ code: code("CNT"), kind: "percent", value: 5, used_count: 3 });
    expect(insert.error?.code).toBe("42501");
    const update = await owner.from("coupons").update({ used_count: 0 }).eq("id", couponIds[0]);
    expect(update.error?.code).toBe("42501");
  });
});

describe("store settings", () => {
  it("lets only the owner update them", async () => {
    const { data: before } = await admin.from("store_settings").select("low_stock_threshold").eq("id", 1).single();
    const next = before!.low_stock_threshold + 1;

    const byStaff = await staff.from("store_settings").update({ low_stock_threshold: next }).eq("id", 1).select("id");
    expect(byStaff.data ?? []).toHaveLength(0);

    const byOwner = await owner
      .from("store_settings")
      .update({ low_stock_threshold: next })
      .eq("id", 1)
      .select("low_stock_threshold")
      .single();
    expect(byOwner.data?.low_stock_threshold).toBe(next);
    await admin.from("store_settings").update({ low_stock_threshold: before!.low_stock_threshold }).eq("id", 1);
  });
});

describe("process_account_deletion", () => {
  async function requester() {
    const c = await createCustomer();
    users.push(c.id);
    await c.client.from("profiles").update({ full_name: "Asha Nair", marketing_consent: true }).eq("id", c.id);
    await admin.from("addresses").insert(testAddress({ user_id: c.id }));
    return c;
  }

  it("refuses accounts that didn't ask, and non-service callers", async () => {
    const c = await requester();
    const notAsked = await admin.rpc("process_account_deletion", { p_user_id: c.id });
    expect(notAsked.error?.message).toContain("deletion:not_requested");

    await c.client.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", c.id);
    for (const client of [c.client, owner]) {
      const denied = await client.rpc("process_account_deletion", { p_user_id: c.id });
      expect(denied.error).not.toBeNull();
    }
  });

  it("doesn't let customers mark their own request processed", async () => {
    const c = await requester();
    const { error } = await c.client
      .from("profiles")
      .update({ deletion_processed_at: new Date().toISOString() })
      .eq("id", c.id);
    expect(error?.code).toBe("42501");
  });

  it("wipes a customer without orders, who can then be deleted", async () => {
    const c = await requester();
    await c.client.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", c.id);

    const { data, error } = await admin.rpc("process_account_deletion", { p_user_id: c.id });
    expect(error).toBeNull();
    expect(data).toBe(0);

    const { data: profile } = await admin.from("profiles").select("*").eq("id", c.id).single();
    expect(profile).toMatchObject({ full_name: null, email: null, phone: null, marketing_consent: false });
    expect(profile?.deletion_processed_at).not.toBeNull();
    const { count } = await admin.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", c.id);
    expect(count).toBe(0);

    const again = await admin.rpc("process_account_deletion", { p_user_id: c.id });
    expect(again.error).not.toBeNull();
    expect((await admin.auth.admin.deleteUser(c.id)).error).toBeNull();
  });

  it("keeps orders and closes the login of a customer with orders", async () => {
    const c = await requester();
    await addToCart(c.client, variants[0].id, 1);
    const order = await createOrder(c.client, { email: c.email });
    expect(order.error).toBeNull();
    await c.client.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", c.id);

    const { data } = await admin.rpc("process_account_deletion", { p_user_id: c.id });
    expect(data).toBe(1);
    const { count: carts } = await admin.from("carts").select("id", { count: "exact", head: true }).eq("user_id", c.id);
    expect(carts).toBe(0);

    // What processDeletion does next (app/admin/(protected)/actions.ts).
    const { error } = await admin.auth.admin.updateUserById(c.id, {
      email: `deleted-${c.id}@deleted.invalid`,
      email_confirm: true,
      phone: "",
      user_metadata: {},
      ban_duration: "876000h",
    });
    expect(error).toBeNull();
    const { data: auth } = await admin.auth.admin.getUserById(c.id);
    expect(auth.user?.email).toBe(`deleted-${c.id}@deleted.invalid`);
    expect(auth.user?.phone ?? "").toBe("");
    expect(new Date(auth.user!.banned_until!).getFullYear()).toBeGreaterThan(2100);

    // The anonymised login isn't copied back onto the profile, and the order keeps its snapshot.
    const { data: profile } = await admin.from("profiles").select("email").eq("id", c.id).single();
    expect(profile?.email).toBeNull();
    const { data: kept } = await admin.from("orders").select("email").eq("user_id", c.id).single();
    expect(kept?.email).toBe(c.email);

    // Release the reservation so restoreStock leaves the variant clean.
    await admin.from("orders").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", c.id);
    await admin.rpc("expire_pending_orders");
  });
});
