import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { istDate, type TaxSlab } from "@/lib/gst";
import { checkoutQuote, couponDiscountPaise } from "@/lib/pricing";
import { zoneForState } from "@/lib/shipping/zones";
import { adminClient, createCustomer, createGuest, deleteUsers } from "./helpers";
import {
  ADDRESS_KARNATAKA,
  ADDRESS_KERALA,
  addToCart,
  attachRazorpayOrder,
  backdateExpiry,
  createOrder,
  fakeRazorpayId,
  orderRow,
  restoreStock,
  setStock,
  stockVariants,
  variantState,
  type StockedVariant,
} from "./order-helpers";

type Customer = Awaited<ReturnType<typeof createCustomer>>;

const admin = adminClient();

async function commit(orderId: string, rzpOrderId: string, amount: number, paymentId = fakeRazorpayId("pay")) {
  return admin.rpc("commit_order_payment", {
    p_order_id: orderId,
    p_razorpay_order_id: rzpOrderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: amount,
    p_method: "upi",
  });
}

let variants: StockedVariant[] = [];
const users: string[] = [];

beforeAll(async () => {
  variants = await stockVariants(3, 50);
});

afterAll(async () => {
  await restoreStock(variants);
  // Users with orders are kept (orders restrict deletion), like real guests with orders.
  await deleteUsers(...users);
});

async function customer(): Promise<Customer> {
  const c = await createCustomer();
  users.push(c.id);
  return c;
}

describe("create_order_from_cart", () => {
  it("prices the cart, reserves stock for 30 minutes and keeps the cart", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[0].id, 2);
    await addToCart(buyer.client, variants[1].id, 1);
    const before = await variantState(variants[0].id);

    const { data, error } = await createOrder(buyer.client, { email: buyer.email });
    expect(error).toBeNull();
    expect(data!.order_number).toMatch(/^ORD-\d{6}$/);

    const { data: order } = await buyer.client
      .from("orders")
      .select("subtotal_paise, discount_paise, shipping_paise, total_paise, taxable_total_paise, cgst_paise, sgst_paise, igst_paise, expires_at, order_status, payment_status")
      .eq("id", data!.order_id)
      .single();
    expect(order!.order_status).toBe("pending_payment");
    expect(order!.payment_status).toBe("unpaid");
    expect(order!.subtotal_paise).toBe(variants[0].pricePaise * 2 + variants[1].pricePaise);
    expect(order!.igst_paise).toBe(0);
    expect(order!.taxable_total_paise + order!.cgst_paise + order!.sgst_paise).toBe(order!.total_paise);
    const minutes = (new Date(order!.expires_at!).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);

    expect((await variantState(variants[0].id)).reserved).toBe(before.reserved + 2);
    const { data: cart } = await buyer.client.rpc("cart_lines");
    expect(cart).toHaveLength(2);
  });

  it("rejects an empty cart and a bad address", async () => {
    const buyer = await customer();
    expect((await createOrder(buyer.client, { email: buyer.email })).error?.message).toBe("checkout:empty");
    await addToCart(buyer.client, variants[0].id, 1);
    const bad = await createOrder(buyer.client, { email: buyer.email, address: { ...ADDRESS_KERALA, pincode: "12" } });
    expect(bad.error?.message).toBe("checkout:address");
  });

  it("matches lib/pricing.ts (the checkout preview) for Kerala and other states, with a coupon", async () => {
    const [{ data: slabRows }, { data: zoneRows }, { data: settings }] = await Promise.all([
      admin.from("tax_slabs").select("*"),
      admin.from("shipping_zones").select("*").eq("is_active", true),
      admin.rpc("checkout_tax_settings").single(),
    ]);
    const slabs: TaxSlab[] = slabRows!.map((s) => ({
      hsnCode: s.hsn_code,
      minUnitPaise: s.min_unit_paise,
      maxUnitPaise: s.max_unit_paise,
      rateBps: s.rate_bps,
      effectiveFrom: s.effective_from,
      effectiveTo: s.effective_to,
    }));
    const zones = zoneRows!.map((z) => ({
      id: z.id,
      name: z.name,
      stateCodes: z.state_codes,
      basePaise: z.base_paise,
      baseWeightGrams: z.base_weight_grams,
      perAdditional500gPaise: z.per_additional_500g_paise,
      freeAbovePaise: z.free_above_paise,
    }));

    for (const [address, coupon] of [
      [ADDRESS_KERALA, undefined],
      [ADDRESS_KARNATAKA, "FLAT200"],
    ] as const) {
      const buyer = await customer();
      await addToCart(buyer.client, variants[0].id, 3);
      await addToCart(buyer.client, variants[2].id, 1);
      const { data: placed, error } = await createOrder(buyer.client, { email: buyer.email, address, coupon });
      expect(error).toBeNull();

      const { data: items } = await admin
        .from("order_items")
        .select("variant_id, unit_price_paise, qty, hsn_code, line_discount_paise, gst_rate_bps, taxable_paise, product_variants(weight_grams)")
        .eq("order_id", placed!.order_id);
      const { data: order } = await admin.from("orders").select("*").eq("id", placed!.order_id).single();

      const subtotal = items!.reduce((s, i) => s + i.unit_price_paise * i.qty, 0);
      const discount = coupon ? couponDiscountPaise({ kind: "flat", value: 20_000, maxDiscountPaise: null }, subtotal) : 0;
      const quote = checkoutQuote({
        lines: items!.map((i) => ({
          variantId: i.variant_id,
          hsnCode: i.hsn_code,
          pricePaise: i.unit_price_paise,
          qty: i.qty,
          weightGrams: i.product_variants.weight_grams,
        })),
        discountPaise: discount,
        zone: zoneForState(zones, address.state_code)!,
        slabs,
        slabBasis: settings!.tax_slab_basis === "taxable" ? "taxable" : "inclusive",
        shippingTaxRateBps: settings!.shipping_tax_rate_bps,
        stateCode: address.state_code,
        sellerStateCode: settings!.state_code,
        onDate: istDate(),
      });

      expect({
        subtotal: order!.subtotal_paise,
        discount: order!.discount_paise,
        shipping: order!.shipping_paise,
        total: order!.total_paise,
        taxable: order!.taxable_total_paise,
        cgst: order!.cgst_paise,
        sgst: order!.sgst_paise,
        igst: order!.igst_paise,
      }).toEqual({
        subtotal: quote.subtotalPaise,
        discount: quote.discountPaise,
        shipping: quote.shippingPaise,
        total: quote.totalPaise,
        taxable: quote.taxableTotalPaise,
        cgst: quote.cgstPaise,
        sgst: quote.sgstPaise,
        igst: quote.igstPaise,
      });
      const byVariant = new Map(quote.lines.map((l) => [l.variantId, l]));
      for (const item of items!) {
        expect(item.line_discount_paise).toBe(byVariant.get(item.variant_id)!.discountPaise);
        expect(item.taxable_paise).toBe(byVariant.get(item.variant_id)!.taxablePaise);
      }
    }
  });

  it("lets exactly one of two buyers reserve the last unit", async () => {
    const [last] = await stockVariants(1, 1, 3);
    try {
      const [a, b] = await Promise.all([customer(), customer()]);
      await addToCart(a.client, last.id, 1);
      await addToCart(b.client, last.id, 1);
      const results = await Promise.all([
        createOrder(a.client, { email: a.email }),
        createOrder(b.client, { email: b.email }),
      ]);
      const ok = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);
      expect(ok).toHaveLength(1);
      expect(failed[0].error?.message).toBe("insufficient_stock");
      expect(await variantState(last.id)).toEqual({ stock: 1, reserved: 1 });
    } finally {
      await restoreStock([last]);
    }
  });
});

describe("RLS and privileges", () => {
  it("lets customers read only their own orders and never write them", async () => {
    const [a, b] = await Promise.all([customer(), customer()]);
    await addToCart(a.client, variants[0].id, 1);
    const { data } = await createOrder(a.client, { email: a.email });

    const { data: seen } = await b.client.from("orders").select("id").eq("id", data!.order_id);
    expect(seen).toEqual([]);
    const { data: items } = await b.client.from("order_items").select("id").eq("order_id", data!.order_id);
    expect(items).toEqual([]);

    const { error: update } = await a.client.from("orders").update({ total_paise: 100 }).eq("id", data!.order_id);
    expect(update?.code).toBe("42501");
    const { error: commitError } = await a.client.rpc("commit_order_payment", {
      p_order_id: data!.order_id,
      p_razorpay_order_id: "order_x",
      p_razorpay_payment_id: "pay_x",
      p_amount_paise: 100,
    });
    expect(commitError?.code).toBe("42501");
  });

  it("only lets the owner attach a Razorpay order", async () => {
    const [a, b] = await Promise.all([customer(), customer()]);
    await addToCart(a.client, variants[0].id, 1);
    const { data } = await createOrder(a.client, { email: a.email });
    const { error } = await b.client.rpc("record_razorpay_order", {
      p_order_id: data!.order_id,
      p_razorpay_order_id: fakeRazorpayId("order"),
    });
    expect(error?.code).toBe("P0002");
    const { error: targetError } = await b.client.rpc("order_payment_target", { p_order_id: data!.order_id }).single();
    expect(targetError?.code).toBe("P0002");
  });
});

describe("commit_order_payment", () => {
  it("commits stock, issues the invoice, records the coupon, clears the cart; is idempotent", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[1].id, 2);
    const before = await variantState(variants[1].id);
    const { data: placed } = await createOrder(buyer.client, { email: buyer.email, coupon: "WELCOME10" });
    const rzp = await attachRazorpayOrder(buyer.client, placed!.order_id);
    const paymentId = fakeRazorpayId("pay");

    const mismatch = await commit(placed!.order_id, rzp, placed!.total_paise + 1, paymentId);
    expect(mismatch.error?.message).toBe("payment:amount_mismatch");

    const { data: result, error } = await commit(placed!.order_id, rzp, placed!.total_paise, paymentId);
    expect(error).toBeNull();
    expect(result).toBe("committed");

    expect(await variantState(variants[1].id)).toEqual({ stock: before.stock - 2, reserved: before.reserved });
    expect(await orderRow(placed!.order_id)).toMatchObject({ order_status: "confirmed", payment_status: "paid" });

    const { data: invoice } = await buyer.client.from("invoices").select("number, lines, totals").eq("order_id", placed!.order_id).single();
    expect(invoice!.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{5}$/);
    expect((invoice!.totals as { total_paise: number }).total_paise).toBe(placed!.total_paise);

    const { data: redemption } = await admin.from("coupon_redemptions").select("email_norm").eq("order_id", placed!.order_id).single();
    expect(redemption!.email_norm).toBe(buyer.email.toLowerCase());
    expect(await buyer.client.rpc("cart_lines").then((r) => r.data)).toEqual([]);

    const again = await commit(placed!.order_id, rzp, placed!.total_paise, paymentId);
    expect(again.data).toBe("already_paid");

    const { error: immutable } = await admin.from("invoices").update({ number: "X" }).eq("order_id", placed!.order_id);
    expect(immutable).not.toBeNull();
  });

  it("numbers invoices without gaps under concurrent commits", async () => {
    const buyers = await Promise.all([customer(), customer(), customer()]);
    const orders = [];
    for (const b of buyers) {
      await addToCart(b.client, variants[2].id, 1);
      const { data } = await createOrder(b.client, { email: b.email });
      orders.push({ ...data!, rzp: await attachRazorpayOrder(b.client, data!.order_id) });
    }
    await Promise.all(orders.map((o) => commit(o.order_id, o.rzp, o.total_paise)));
    const { data: invoices } = await admin
      .from("invoices")
      .select("number")
      .in("order_id", orders.map((o) => o.order_id));
    const seqs = invoices!.map((i) => Number(i.number.split("/")[2])).sort((x, y) => x - y);
    expect(seqs).toHaveLength(3);
    expect(seqs[2] - seqs[0]).toBe(2);
  });

  it("stops a fresh guest with the same email from reusing a first-order coupon", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[0].id, 1);
    const { data } = await createOrder(buyer.client, { email: buyer.email, coupon: "WELCOME10" });
    const rzp = await attachRazorpayOrder(buyer.client, data!.order_id);
    await commit(data!.order_id, rzp, data!.total_paise);

    const guest = await createGuest();
    users.push(guest.id);
    await addToCart(guest.client, variants[0].id, 1);
    const reuse = await createOrder(guest.client, { email: buyer.email.toUpperCase(), coupon: "WELCOME10" });
    expect(reuse.error?.message).toMatch(/^coupon:(used|first_order)$/);
  });

  it("accepts a success after a failed attempt", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[0].id, 1);
    const { data } = await createOrder(buyer.client, { email: buyer.email });
    const rzp = await attachRazorpayOrder(buyer.client, data!.order_id);
    await admin.rpc("mark_payment_failed", {
      p_order_id: data!.order_id,
      p_razorpay_order_id: rzp,
      p_razorpay_payment_id: fakeRazorpayId("pay"),
    });
    expect((await orderRow(data!.order_id)).payment_status).toBe("failed");
    expect((await commit(data!.order_id, rzp, data!.total_paise)).data).toBe("committed");
    expect((await orderRow(data!.order_id)).payment_status).toBe("paid");
  });
});

describe("expiry and late payments", () => {
  it("expires unpaid orders and releases their stock", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[2].id, 2);
    const before = await variantState(variants[2].id);
    const { data } = await createOrder(buyer.client, { email: buyer.email });
    expect((await variantState(variants[2].id)).reserved).toBe(before.reserved + 2);

    await backdateExpiry(data!.order_id);
    const { data: count } = await admin.rpc("expire_pending_orders");
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await orderRow(data!.order_id)).order_status).toBe("expired");
    expect((await variantState(variants[2].id)).reserved).toBe(before.reserved);
  });

  it("confirms a late payment when stock is still there", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[2].id, 1);
    const { data } = await createOrder(buyer.client, { email: buyer.email });
    const rzp = await attachRazorpayOrder(buyer.client, data!.order_id);
    await backdateExpiry(data!.order_id);
    await admin.rpc("expire_pending_orders");

    const notPending = await commit(data!.order_id, rzp, data!.total_paise);
    expect(notPending.error?.message).toBe("payment:not_pending");

    const { data: ok, error } = await admin.rpc("late_payment_commit", {
      p_order_id: data!.order_id,
      p_razorpay_order_id: rzp,
      p_razorpay_payment_id: fakeRazorpayId("pay"),
      p_amount_paise: data!.total_paise,
    });
    expect(error).toBeNull();
    expect(ok).toBe(true);
    expect(await orderRow(data!.order_id)).toMatchObject({ order_status: "confirmed", payment_status: "paid" });
  });

  it("flags a late payment without stock for an automatic refund", async () => {
    const [scarce] = await stockVariants(1, 1, 4);
    try {
      const buyer = await customer();
      await addToCart(buyer.client, scarce.id, 1);
      const { data } = await createOrder(buyer.client, { email: buyer.email });
      const rzp = await attachRazorpayOrder(buyer.client, data!.order_id);
      await backdateExpiry(data!.order_id);
      await admin.rpc("expire_pending_orders");
      await setStock(scarce.id, 0);

      const paymentId = fakeRazorpayId("pay");
      const { data: ok } = await admin.rpc("late_payment_commit", {
        p_order_id: data!.order_id,
        p_razorpay_order_id: rzp,
        p_razorpay_payment_id: paymentId,
        p_amount_paise: data!.total_paise,
      });
      expect(ok).toBe(false);
      expect(await orderRow(data!.order_id)).toMatchObject({
        order_status: "expired",
        payment_status: "paid",
        needs_attention: true,
      });

      await admin.rpc("record_auto_refund", {
        p_order_id: data!.order_id,
        p_razorpay_payment_id: paymentId,
        p_razorpay_refund_id: fakeRazorpayId("rfnd"),
        p_amount_paise: data!.total_paise,
        p_status: "processed",
      });
      expect((await orderRow(data!.order_id)).payment_status).toBe("refunded");
      const { data: invoice } = await admin.from("invoices").select("id").eq("order_id", data!.order_id);
      expect(invoice).toEqual([]);
    } finally {
      await restoreStock([scarce]);
    }
  });
});

describe("transition_order and guest merge", () => {
  it("rejects transitions the status machine doesn't allow", async () => {
    const buyer = await customer();
    await addToCart(buyer.client, variants[0].id, 1);
    const { data } = await createOrder(buyer.client, { email: buyer.email });
    const { error } = await admin.rpc("transition_order", {
      p_order_id: data!.order_id,
      p_field: "fulfillment_status",
      p_to_value: "shipped",
    });
    expect(error?.code).toBe("22023");
    const { error: skip } = await admin.rpc("transition_order", {
      p_order_id: data!.order_id,
      p_field: "order_status",
      p_to_value: "completed",
    });
    expect(skip?.code).toBe("22023");
  });

  it("moves a guest's orders to the account on merge", async () => {
    const [account, guest] = await Promise.all([customer(), createGuest()]);
    await addToCart(guest.client, variants[0].id, 1);
    const { data } = await createOrder(guest.client, { email: account.email });
    const { error } = await admin.rpc("merge_guest_into_user", { p_anon_uid: guest.id, p_user_id: account.id });
    expect(error).toBeNull();
    expect((await orderRow(data!.order_id)).user_id).toBe(account.id);
    await deleteUsers(guest.id);
  });
});
