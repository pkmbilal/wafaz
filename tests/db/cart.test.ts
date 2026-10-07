import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createCustomer, createGuest, deleteUsers, type TestClient } from "./helpers";

type Customer = Awaited<ReturnType<typeof createCustomer>>;
type Guest = { id: string; client: TestClient };

// Two active seed variants, topped up to plenty of stock so caps come from the 10-per-line
// limit unless a test lowers it. Original stock is restored afterwards.
let stocked: { id: string; stock: number }[] = [];

beforeAll(async () => {
  const { data, error } = await adminClient()
    .from("product_variants")
    .select("id, stock, products!inner(status)")
    .eq("is_active", true)
    .eq("reserved", 0)
    .eq("products.status", "active")
    .order("sku")
    .limit(2);
  if (error) throw error;
  if (!data || data.length < 2) throw new Error("seed needs at least two active variants");
  stocked = data.map((v) => ({ id: v.id, stock: v.stock }));
  await Promise.all(stocked.map((v) => adminClient().from("product_variants").update({ stock: 50 }).eq("id", v.id)));
});

afterAll(async () => {
  await Promise.all(
    stocked.map((v) => adminClient().from("product_variants").update({ stock: v.stock }).eq("id", v.id)),
  );
});

async function activeVariants(count: number): Promise<string[]> {
  return stocked.slice(0, count).map((v) => v.id);
}

async function addItem(client: TestClient, variantId: string, qty: number) {
  return client.rpc("cart_add_item", { p_variant_id: variantId, p_qty: qty }).single();
}

async function lines(client: TestClient) {
  const { data, error } = await client.rpc("cart_lines");
  if (error) throw error;
  return data;
}

describe("cart RLS", () => {
  let a: Customer;
  let b: Customer;
  let guest: Guest;
  let variant: string;

  beforeAll(async () => {
    [a, b, guest] = await Promise.all([createCustomer(), createCustomer(), createGuest()]);
    [variant] = await activeVariants(1);
  });

  afterAll(() => deleteUsers(a?.id, b?.id, guest?.id));

  it("lets each user see and change only their own cart", async () => {
    expect((await addItem(a.client, variant, 1)).error).toBeNull();
    const [line] = await lines(a.client);

    const { data: carts } = await b.client.from("carts").select("id");
    expect(carts).toEqual([]);
    const { data: items } = await b.client.from("cart_items").select("id").eq("id", line.item_id);
    expect(items).toEqual([]);

    const { error } = await b.client.rpc("cart_set_qty", { p_item_id: line.item_id, p_qty: 5 });
    expect(error?.code).toBe("P0002");
    await b.client.from("cart_items").delete().eq("id", line.item_id);

    expect(await lines(b.client)).toEqual([]);
    const [still] = await lines(a.client);
    expect(still.qty).toBe(1);
  });

  it("rejects adding a line to someone else's cart", async () => {
    const { data: cart } = await a.client.from("carts").select("id").single();
    const { error } = await b.client.from("cart_items").insert({ cart_id: cart!.id, variant_id: variant, qty: 1 });
    expect(error?.code).toBe("42501");
  });

  it("gives an anonymous guest their own cart", async () => {
    expect((await addItem(guest.client, variant, 2)).error).toBeNull();
    const { data } = await guest.client.from("carts").select("user_id");
    expect(data).toEqual([{ user_id: guest.id }]);
  });

  it("is not available to signed-out visitors", async () => {
    const { error } = await anonClient().rpc("cart_add_item", { p_variant_id: variant, p_qty: 1 });
    expect(error).not.toBeNull();
  });
});

describe("cart_add_item / cart_set_qty", () => {
  let customer: Customer;
  let variant: string;

  beforeAll(async () => {
    customer = await createCustomer();
    [variant] = await activeVariants(1);
  });

  afterAll(() => deleteUsers(customer?.id));

  it("creates the cart, sums repeated adds and caps a line at 10", async () => {
    const first = await addItem(customer.client, variant, 3);
    expect(first.data).toMatchObject({ qty: 3, requested: 3 });

    const second = await addItem(customer.client, variant, 9);
    expect(second.data).toMatchObject({ qty: 10, requested: 10 });

    const all = await lines(customer.client);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ qty: 10, purchasable: true });
  });

  it("caps at available stock and reports the shortfall", async () => {
    const admin = adminClient();
    await customer.client.from("cart_items").delete().eq("variant_id", variant);
    try {
      await admin.from("product_variants").update({ stock: 2 }).eq("id", variant);
      const { data } = await addItem(customer.client, variant, 5);
      expect(data).toEqual({ qty: 2, requested: 5, available: 2 });

      await admin.from("product_variants").update({ stock: 0 }).eq("id", variant);
      const [line] = await lines(customer.client);
      expect(line).toMatchObject({ qty: 2, available: 0 });
    } finally {
      await admin.from("product_variants").update({ stock: 50 }).eq("id", variant);
    }
  });

  it("rejects a variant that is not on sale", async () => {
    const admin = adminClient();
    await admin.from("product_variants").update({ is_active: false }).eq("id", variant);
    try {
      const { error } = await addItem(customer.client, variant, 1);
      expect(error?.code).toBe("P0002");
      // The existing line stays visible, flagged as not purchasable.
      const [line] = await lines(customer.client);
      expect(line.purchasable).toBe(false);
    } finally {
      await admin.from("product_variants").update({ is_active: true }).eq("id", variant);
    }
  });

  it("sets a quantity and removes the line at 0", async () => {
    const [line] = await lines(customer.client);
    const { data: qty } = await customer.client.rpc("cart_set_qty", { p_item_id: line.item_id, p_qty: 4 });
    expect(qty).toBe(4);

    const { data: removed } = await customer.client.rpc("cart_set_qty", { p_item_id: line.item_id, p_qty: 0 });
    expect(removed).toBe(0);
    expect(await lines(customer.client)).toEqual([]);
  });

  it("rejects out-of-range quantities", async () => {
    expect((await addItem(customer.client, variant, 11)).error?.code).toBe("22023");
    expect((await addItem(customer.client, variant, 0)).error?.code).toBe("22023");
  });
});

describe("merge_guest_into_user (cart)", () => {
  it("sums overlapping lines (capped at 10), moves the rest and removes the guest cart", async () => {
    const [customer, guest] = await Promise.all([createCustomer(), createGuest()]);
    const [shared, guestOnly] = await activeVariants(2);
    try {
      await addItem(customer.client, shared, 6);
      await addItem(guest.client, shared, 7);
      await addItem(guest.client, guestOnly, 2);
      const { data: guestCart } = await guest.client.from("carts").select("id").single();

      const { error } = await adminClient().rpc("merge_guest_into_user", {
        p_anon_uid: guest.id,
        p_user_id: customer.id,
      });
      expect(error).toBeNull();

      const merged = await lines(customer.client);
      const qtyOf = (id: string) => merged.find((l) => l.variant_id === id)?.qty;
      expect(qtyOf(shared)).toBe(10);
      expect(qtyOf(guestOnly)).toBe(2);

      const { data: gone } = await adminClient().from("carts").select("id").eq("id", guestCart!.id);
      expect(gone).toEqual([]);
    } finally {
      await deleteUsers(customer.id, guest.id);
    }
  });

  it("creates the account's cart when it had none", async () => {
    const [customer, guest] = await Promise.all([createCustomer(), createGuest()]);
    const [variant] = await activeVariants(1);
    try {
      await addItem(guest.client, variant, 1);
      const { error } = await adminClient().rpc("merge_guest_into_user", {
        p_anon_uid: guest.id,
        p_user_id: customer.id,
      });
      expect(error).toBeNull();
      expect((await lines(customer.client)).map((l) => l.qty)).toEqual([1]);
    } finally {
      await deleteUsers(customer.id, guest.id);
    }
  });
});
