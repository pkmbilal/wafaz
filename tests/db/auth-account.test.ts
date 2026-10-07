import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createCustomer,
  createGuest,
  deleteUsers,
  testAddress,
  type TestClient,
} from "./helpers";

type Customer = Awaited<ReturnType<typeof createCustomer>>;

describe("addresses RLS", () => {
  let a: Customer;
  let b: Customer;
  let guest: { id: string; client: TestClient };

  beforeAll(async () => {
    [a, b, guest] = await Promise.all([createCustomer(), createCustomer(), createGuest()]);
  });

  afterAll(() => deleteUsers(a?.id, b?.id, guest?.id));

  it("lets a customer manage only their own addresses", async () => {
    const { data: own, error } = await a.client
      .from("addresses")
      .insert(testAddress({ user_id: a.id }))
      .select("id")
      .single();
    expect(error).toBeNull();

    // B cannot read, update or delete A's address.
    const { data: seen } = await b.client.from("addresses").select("id").eq("id", own!.id);
    expect(seen).toEqual([]);

    const { data: updated } = await b.client
      .from("addresses")
      .update({ city: "Hacked" })
      .eq("id", own!.id)
      .select("id");
    expect(updated).toEqual([]);

    await b.client.from("addresses").delete().eq("id", own!.id);
    const { data: still } = await a.client.from("addresses").select("city").eq("id", own!.id).single();
    expect(still?.city).toBe("Kochi");
  });

  it("rejects inserting an address for someone else", async () => {
    const { error } = await b.client.from("addresses").insert(testAddress({ user_id: a.id }));
    expect(error?.code).toBe("42501");
  });

  it("lets an anonymous guest see only their own rows", async () => {
    const { error } = await guest.client.from("addresses").insert(testAddress({ user_id: guest.id }));
    expect(error).toBeNull();

    const { data } = await guest.client.from("addresses").select("user_id");
    expect(data?.every((r) => r.user_id === guest.id)).toBe(true);
    expect(data?.length).toBe(1);
  });

  it("keeps a single default via set_default_address", async () => {
    const ids: string[] = [];
    for (const line1 of ["1 First St", "2 Second St"]) {
      const { data } = await a.client
        .from("addresses")
        .insert(testAddress({ user_id: a.id, line1 }))
        .select("id")
        .single();
      ids.push(data!.id);
    }

    for (const id of ids) {
      const { error } = await a.client.rpc("set_default_address", { p_address_id: id });
      expect(error).toBeNull();
    }

    const { data } = await a.client.from("addresses").select("id").eq("is_default", true);
    expect(data).toEqual([{ id: ids[1] }]);

    // Another customer's address can't be made default.
    const { error } = await b.client.rpc("set_default_address", { p_address_id: ids[0] });
    expect(error).not.toBeNull();
  });

  it("enforces the Indian phone and PIN code formats", async () => {
    const bad = await a.client
      .from("addresses")
      .insert(testAddress({ user_id: a.id, phone: "+15551234567" }));
    expect(bad.error?.code).toBe("23514");

    const badPin = await a.client
      .from("addresses")
      .insert(testAddress({ user_id: a.id, pincode: "12345" }));
    expect(badPin.error?.code).toBe("23514");
  });
});

describe("auth_hook_events", () => {
  let customer: Customer;
  let staff: Customer;

  beforeAll(async () => {
    [customer, staff] = await Promise.all([createCustomer(), createCustomer()]);
    await adminClient().from("profiles").update({ role: "staff" }).eq("id", staff.id);
    await adminClient().from("auth_hook_events").insert({
      recipient_hash: "a".repeat(64),
      status: "failed",
      error: "test",
    });
  });

  afterAll(async () => {
    await adminClient().from("auth_hook_events").delete().eq("recipient_hash", "a".repeat(64));
    await deleteUsers(customer?.id, staff?.id);
  });

  it("is hidden from customers and staff", async () => {
    for (const user of [customer, staff]) {
      const { data } = await user.client.from("auth_hook_events").select("id");
      expect(data).toEqual([]);
    }
  });

  it("cannot be written by signed-in users", async () => {
    const { error } = await customer.client
      .from("auth_hook_events")
      .insert({ recipient_hash: "b".repeat(64), status: "sent" });
    expect(error).not.toBeNull();
  });
});

describe("profile contact sync", () => {
  it("copies a guest's verified phone and email onto the profile", async () => {
    const guest = await createGuest();
    try {
      const { error } = await adminClient().auth.admin.updateUserById(guest.id, {
        phone: "919876500001",
        email: `Guest-${guest.id}@Example.com`,
      });
      expect(error).toBeNull();

      const { data } = await adminClient()
        .from("profiles")
        .select("phone, email")
        .eq("id", guest.id)
        .single();
      expect(data).toEqual({ phone: "+919876500001", email: `guest-${guest.id}@example.com` });
    } finally {
      await deleteUsers(guest.id);
    }
  });

  it("ignores non-Indian numbers", async () => {
    const guest = await createGuest();
    try {
      await adminClient().auth.admin.updateUserById(guest.id, { phone: "15551234567" });
      const { data } = await adminClient().from("profiles").select("phone").eq("id", guest.id).single();
      expect(data?.phone).toBeNull();
    } finally {
      await deleteUsers(guest.id);
    }
  });
});

describe("merge_guest_into_user", () => {
  it("moves the guest's addresses and profile name, then deletes the guest", async () => {
    const [guest, customer] = await Promise.all([createGuest(), createCustomer()]);
    try {
      await guest.client.from("profiles").update({ full_name: "Guest Name" }).eq("id", guest.id);
      await guest.client.from("addresses").insert(testAddress({ user_id: guest.id, is_default: true }));
      await customer.client
        .from("addresses")
        .insert(testAddress({ user_id: customer.id, line1: "Own default", is_default: true }));

      const { error } = await adminClient().rpc("merge_guest_into_user", {
        p_anon_uid: guest.id,
        p_user_id: customer.id,
      });
      expect(error).toBeNull();

      const { data: addresses } = await customer.client
        .from("addresses")
        .select("line1, is_default")
        .order("line1");
      expect(addresses).toEqual([
        { line1: "12 MG Road", is_default: false },
        { line1: "Own default", is_default: true },
      ]);

      const { data: profile } = await customer.client
        .from("profiles")
        .select("full_name")
        .eq("id", customer.id)
        .single();
      expect(profile?.full_name).toBe("Guest Name");

      const { data: gone } = await adminClient().auth.admin.getUserById(guest.id);
      expect(gone.user).toBeNull();
    } finally {
      await deleteUsers(guest.id, customer.id);
    }
  });

  it("refuses a non-anonymous source user", async () => {
    const [a, b] = await Promise.all([createCustomer(), createCustomer()]);
    try {
      const { error } = await adminClient().rpc("merge_guest_into_user", {
        p_anon_uid: a.id,
        p_user_id: b.id,
      });
      expect(error?.message).toMatch(/not an anonymous user/);
    } finally {
      await deleteUsers(a.id, b.id);
    }
  });

  it("is not callable by signed-in users", async () => {
    const [guest, customer] = await Promise.all([createGuest(), createCustomer()]);
    try {
      const { error } = await customer.client.rpc("merge_guest_into_user", {
        p_anon_uid: guest.id,
        p_user_id: customer.id,
      });
      expect(error?.code).toBe("42501");
    } finally {
      await deleteUsers(guest.id, customer.id);
    }
  });
});

describe("check_rate_limit grants", () => {
  it("is not callable with the anon key", async () => {
    const { anonClient } = await import("./helpers");
    const { error } = await anonClient().rpc("check_rate_limit", {
      p_key: "otp:test",
      p_max: 5,
      p_window_seconds: 60,
    });
    expect(error?.code).toBe("42501");
  });
});
