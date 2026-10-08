import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stubPublicEnv } from "../stubs/public-env";
import { adminClient, createCustomer, deleteUsers, type TestClient } from "./helpers";
import {
  ADDRESS_KARNATAKA,
  ADDRESS_KERALA,
  addToCart,
  attachRazorpayOrder,
  createOrder,
  fakeRazorpayId,
  orderRow,
  restoreStock,
  stockVariants,
  variantState,
  type StockedVariant,
} from "./order-helpers";

// M8: shipping, delivery, RTO, cancellation, refunds and credit notes (DATA_MODEL §4, §5).

const admin = adminClient();
const SECRET = "whsec_test_webhook_secret";

type Refunds = typeof import("@/lib/orders/refunds");
let runRefund: Refunds["runRefund"];
let handle: typeof import("@/lib/payments/razorpay-webhook").handleRazorpayWebhook;

let variants: StockedVariant[] = [];
const users: string[] = [];
let ownerId: string;

const razorpayRefund = vi.fn(async () => ({ id: fakeRazorpayId("rfnd"), status: "pending" as const }));

beforeAll(async () => {
  stubPublicEnv();
  ({ runRefund } = await import("@/lib/orders/refunds"));
  ({ handleRazorpayWebhook: handle } = await import("@/lib/payments/razorpay-webhook"));
  variants = await stockVariants(3, 50, 10);
  const owner = await createCustomer();
  users.push(owner.id);
  ownerId = owner.id;
  const { error } = await admin.from("profiles").update({ role: "owner" }).eq("id", owner.id);
  if (error) throw error;
});

afterAll(async () => {
  await restoreStock(variants);
  await deleteUsers(...users);
});

type Buyer = { id: string; email: string; client: TestClient };

async function buyer(): Promise<Buyer> {
  const c = await createCustomer();
  users.push(c.id);
  return c;
}

// A confirmed, paid order with an invoice.
async function paidOrder(
  lines: { variant: StockedVariant; qty: number }[],
  opts: { address?: typeof ADDRESS_KERALA; who?: Buyer } = {},
) {
  const b = opts.who ?? (await buyer());
  for (const l of lines) await addToCart(b.client, l.variant.id, l.qty);
  const { data, error } = await createOrder(b.client, { email: b.email, address: opts.address });
  if (error) throw error;
  const rzpOrderId = await attachRazorpayOrder(b.client, data!.order_id);
  const paymentId = fakeRazorpayId("pay");
  const { error: commitError } = await admin.rpc("commit_order_payment", {
    p_order_id: data!.order_id,
    p_razorpay_order_id: rzpOrderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: data!.total_paise,
    p_method: "upi",
  });
  if (commitError) throw commitError;
  return { orderId: data!.order_id, total: data!.total_paise, paymentId, buyer: b };
}

async function items(orderId: string) {
  const { data, error } = await admin
    .from("order_items")
    .select("id, qty, refunded_qty, variant_id")
    .eq("order_id", orderId)
    .order("id");
  if (error) throw error;
  return data;
}

async function creditNotes(orderId: string) {
  const { data, error } = await admin
    .from("credit_notes")
    .select("number, totals, lines")
    .eq("order_id", orderId)
    .order("number");
  if (error) throw error;
  return data as { number: string; totals: Record<string, number>; lines: Record<string, number>[] }[];
}

function refund(orderId: string, kind: "partial" | "cancel" | "rto", extra: Partial<Parameters<Refunds["runRefund"]>[1]> = {}) {
  return runRefund(
    admin,
    { orderId, kind, items: [], includeShipping: false, reason: "Test refund", actorId: ownerId, ...extra },
    razorpayRefund,
  );
}

async function ship(orderId: string) {
  return admin.rpc("ship_order", {
    p_order_id: orderId,
    p_courier: "dtdc",
    p_tracking_number: "D1234567",
    p_actor_id: ownerId,
  });
}

describe("ship and deliver", () => {
  it("ships an unfulfilled order through 'packed', then delivers and completes it", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    expect((await ship(order.orderId)).error).toBeNull();

    const { data: o } = await admin.from("orders").select("fulfillment_status").eq("id", order.orderId).single();
    expect(o!.fulfillment_status).toBe("shipped");
    const { data: events } = await admin
      .from("order_events")
      .select("to_value, actor_id")
      .eq("order_id", order.orderId)
      .eq("field", "fulfillment_status")
      .order("created_at");
    expect(events!.map((e) => e.to_value)).toEqual(["packed", "shipped"]);
    expect(events!.every((e) => e.actor_id === ownerId)).toBe(true);

    expect((await admin.rpc("mark_order_delivered", { p_order_id: order.orderId, p_actor_id: ownerId })).error).toBeNull();
    const { data: done } = await admin
      .from("orders")
      .select("order_status, fulfillment_status, shipments(delivered_at)")
      .eq("id", order.orderId)
      .single();
    expect(done).toMatchObject({ order_status: "completed", fulfillment_status: "delivered" });
    expect(done!.shipments?.delivered_at).not.toBeNull();
  });

  it("refuses to ship an unpaid order or ship twice", async () => {
    const b = await buyer();
    await addToCart(b.client, variants[0].id, 1);
    const { data } = await createOrder(b.client, { email: b.email });
    expect((await ship(data!.order_id)).error?.message).toBe("ship:not_paid");

    const paid = await paidOrder([{ variant: variants[0], qty: 1 }]);
    expect((await ship(paid.orderId)).error).toBeNull();
    expect((await ship(paid.orderId)).error).not.toBeNull();
  });
});

describe("refunds and credit notes", () => {
  it("cancels a paid order: full refund, credit note, restock", async () => {
    const order = await paidOrder([
      { variant: variants[0], qty: 2 },
      { variant: variants[1], qty: 1 },
    ]);
    const before = await variantState(variants[0].id);

    const result = await refund(order.orderId, "cancel", { reason: "Customer changed their mind" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amountPaise).toBe(order.total);
    expect(result.creditNoteNumber).toMatch(/^CN\/\d{2}-\d{2}\/\d{5}$/);
    expect(result.notices).toEqual([{ type: "order_cancelled", orderId: order.orderId, refundId: result.refundId }]);
    expect(result.productIds.sort()).toEqual([...new Set([variants[0].productId, variants[1].productId])].sort());

    expect(await orderRow(order.orderId)).toMatchObject({ order_status: "cancelled", payment_status: "refunded" });
    expect((await variantState(variants[0].id)).stock).toBe(before.stock + 2);
    expect((await items(order.orderId)).every((i) => i.refunded_qty === i.qty)).toBe(true);

    const [note] = await creditNotes(order.orderId);
    expect(note.totals.total_paise).toBe(order.total);
    const { data: o } = await admin
      .from("orders")
      .select("cgst_paise, sgst_paise, igst_paise, taxable_total_paise")
      .eq("id", order.orderId)
      .single();
    expect(note.totals).toMatchObject({
      cgst_paise: o!.cgst_paise,
      sgst_paise: o!.sgst_paise,
      igst_paise: o!.igst_paise,
      taxable_total_paise: o!.taxable_total_paise,
    });
  });

  it("won't cancel once shipped", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    await ship(order.orderId);
    const result = await refund(order.orderId, "cancel");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("haven't shipped") });
  });

  it("partial refunds add up exactly to the invoice", async () => {
    // Inter-state, so IGST; three units so the per-unit split has remainders.
    const order = await paidOrder([{ variant: variants[2], qty: 3 }], { address: ADDRESS_KARNATAKA });
    const [item] = await items(order.orderId);
    const stockBefore = await variantState(variants[2].id);

    const one = { order_item_id: item.id, qty: 1 };
    expect((await refund(order.orderId, "partial", { items: [one] })).ok).toBe(true);
    expect((await orderRow(order.orderId)).payment_status).toBe("partially_refunded");
    expect((await refund(order.orderId, "partial", { items: [one] })).ok).toBe(true);

    // Shipping can't go before the last item.
    const early = await refund(order.orderId, "partial", { items: [], includeShipping: true });
    expect(early.ok).toBe(false);

    const last = await refund(order.orderId, "partial", { items: [one], includeShipping: true });
    expect(last.ok).toBe(true);
    expect(await orderRow(order.orderId)).toMatchObject({ order_status: "confirmed", payment_status: "refunded" });
    // Partial refunds don't restock.
    expect((await variantState(variants[2].id)).stock).toBe(stockBefore.stock);

    const notes = await creditNotes(order.orderId);
    expect(notes).toHaveLength(3);
    const sum = (key: string) => notes.reduce((acc, n) => acc + n.totals[key], 0);
    const { data: o } = await admin
      .from("orders")
      .select("total_paise, igst_paise, cgst_paise, taxable_total_paise")
      .eq("id", order.orderId)
      .single();
    expect(sum("total_paise")).toBe(o!.total_paise);
    expect(sum("igst_paise")).toBe(o!.igst_paise);
    expect(sum("cgst_paise")).toBe(0);
    expect(sum("taxable_total_paise")).toBe(o!.taxable_total_paise);
    for (const n of notes) {
      for (const l of n.lines) {
        expect(l.taxable_paise + l.cgst_paise + l.sgst_paise + l.igst_paise).toBe(l.total_paise);
      }
    }

    // Nothing left.
    expect((await refund(order.orderId, "partial", { items: [one] })).ok).toBe(false);
  });

  it("a Razorpay rejection fails the refund without taking a credit-note number", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    const fy = (await admin.from("document_sequences").select("fiscal_year, last_value").eq("doc_type", "credit_note"))
      .data;
    const rejecting = vi.fn(async () => {
      throw { statusCode: 400, error: { description: "The refund amount is invalid" } };
    });
    const [item] = await items(order.orderId);
    const result = await runRefund(
      admin,
      {
        orderId: order.orderId,
        kind: "partial",
        items: [{ order_item_id: item.id, qty: 1 }],
        includeShipping: false,
        reason: "Test",
        actorId: ownerId,
      },
      rejecting,
    );
    expect(result).toEqual({ ok: false, error: expect.stringContaining("The refund amount is invalid") });

    const { data: rows } = await admin.from("refunds").select("status, error").eq("order_id", order.orderId);
    expect(rows).toEqual([{ status: "failed", error: "The refund amount is invalid" }]);
    expect(await creditNotes(order.orderId)).toEqual([]);
    expect(await orderRow(order.orderId)).toMatchObject({ payment_status: "paid", needs_attention: true });
    const after = (await admin.from("document_sequences").select("fiscal_year, last_value").eq("doc_type", "credit_note"))
      .data;
    expect(after).toEqual(fy);
    expect((await items(order.orderId))[0].refunded_qty).toBe(0);
  });

  it("two concurrent refunds of the last unit can't both go through", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    const [item] = await items(order.orderId);
    const prepare = () =>
      admin
        .rpc("prepare_refund", {
          p_order_id: order.orderId,
          p_kind: "partial",
          p_items: [{ order_item_id: item.id, qty: 1 }],
          p_include_shipping: false,
          p_reason: "Race",
          p_actor_id: ownerId,
        })
        .single();
    const results = await Promise.all([prepare(), prepare()]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.find((r) => r.error)!.error!.message).toBe("refund:in_progress");
  });

  it("RTO: restocks, refunds and cancels once the parcel is received", async () => {
    const order = await paidOrder([{ variant: variants[1], qty: 1 }]);
    const stock = (await variantState(variants[1].id)).stock;
    await ship(order.orderId);

    // Not before the RTO is recorded.
    expect((await refund(order.orderId, "rto")).ok).toBe(false);
    expect((await admin.rpc("mark_order_rto", { p_order_id: order.orderId, p_actor_id: ownerId })).error).toBeNull();

    const result = await refund(order.orderId, "rto", { includeShipping: true, reason: "Parcel returned" });
    expect(result.ok).toBe(true);
    expect(await orderRow(order.orderId)).toMatchObject({ order_status: "cancelled", payment_status: "refunded" });
    expect((await variantState(variants[1].id)).stock).toBe(stock + 1);
    const { data: shipment } = await admin.from("shipments").select("rto_at, rto_received_at").eq("order_id", order.orderId).single();
    expect(shipment!.rto_at).not.toBeNull();
    expect(shipment!.rto_received_at).not.toBeNull();
  });

  it("credit notes are immutable", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    await refund(order.orderId, "cancel");
    const { error } = await admin.from("credit_notes").update({ reason: "changed" }).eq("order_id", order.orderId);
    expect(error?.message).toContain("immutable");
  });
});

describe("RLS", () => {
  it("customers read only their own shipments and credit notes", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    await ship(order.orderId);
    await admin.rpc("mark_order_rto", { p_order_id: order.orderId, p_actor_id: ownerId });
    await refund(order.orderId, "rto");

    const own = order.buyer.client;
    expect((await own.from("shipments").select("id").eq("order_id", order.orderId)).data).toHaveLength(1);
    expect((await own.from("credit_notes").select("id").eq("order_id", order.orderId)).data).toHaveLength(1);

    const stranger = await buyer();
    expect((await stranger.client.from("shipments").select("id").eq("order_id", order.orderId)).data).toEqual([]);
    expect((await stranger.client.from("credit_notes").select("id").eq("order_id", order.orderId)).data).toEqual([]);
    // Customers can't call the admin functions.
    const { error } = await own.rpc("ship_order", {
      p_order_id: order.orderId,
      p_courier: "dtdc",
      p_tracking_number: "X123",
      p_actor_id: order.buyer.id,
    });
    expect(error).not.toBeNull();
  });
});

describe("needs attention", () => {
  it("resolving clears the flag and logs a note", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    await admin.from("orders").update({ needs_attention: true, attention_reason: "Test flag" }).eq("id", order.orderId);
    const { error } = await admin.rpc("resolve_attention", {
      p_order_id: order.orderId,
      p_note: "Checked with customer",
      p_actor_id: ownerId,
    });
    expect(error).toBeNull();
    expect((await orderRow(order.orderId)).needs_attention).toBe(false);
    const { data: notes } = await admin.from("order_events").select("note").eq("order_id", order.orderId).eq("field", "note");
    expect(notes!.at(-1)!.note).toContain("Test flag");
    expect(notes!.at(-1)!.note).toContain("Checked with customer");
  });
});

describe("refund webhooks", () => {
  function refundEvent(
    name: "refund.processed" | "refund.failed",
    v: { refundId: string; paymentId: string; amount: number; notes?: Record<string, string> },
  ) {
    return readFileSync(new URL(`../fixtures/razorpay/${name}.json`, import.meta.url), "utf8")
      .replace("{{REFUND_ID}}", v.refundId)
      .replaceAll("{{PAYMENT_ID}}", v.paymentId)
      .replaceAll('"{{AMOUNT}}"', String(v.amount))
      .replace('"{{NOTES}}"', JSON.stringify(v.notes ?? []));
  }

  const notify = vi.fn();
  const stockChanged = vi.fn();
  function deliver(rawBody: string, eventId = `evt_${randomUUID()}`) {
    const signature = createHmac("sha256", SECRET).update(rawBody).digest("hex");
    return handle(
      { rawBody, signature, eventId },
      { admin, webhookSecret: SECRET, refund: razorpayRefund, notify, onStockChanged: stockChanged },
    );
  }

  it("refund.processed marks an accepted refund processed; a duplicate is ignored", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    const result = await refund(order.orderId, "cancel");
    if (!result.ok) throw new Error(result.error);
    const { data: row } = await admin.from("refunds").select("razorpay_refund_id, status").eq("id", result.refundId).single();
    expect(row!.status).toBe("pending");

    const body = refundEvent("refund.processed", {
      refundId: row!.razorpay_refund_id!,
      paymentId: order.paymentId,
      amount: result.amountPaise,
    });
    const eventId = `evt_${randomUUID()}`;
    expect((await deliver(body, eventId)).body.result).toBe("refund_processed");
    expect((await deliver(body, eventId)).body.result).toBe("duplicate");
    const { data: after } = await admin.from("refunds").select("status").eq("id", result.refundId).single();
    expect(after!.status).toBe("processed");
  });

  it("refund.failed after acceptance flags the order", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }]);
    const result = await refund(order.orderId, "cancel");
    if (!result.ok) throw new Error(result.error);
    const { data: row } = await admin.from("refunds").select("razorpay_refund_id").eq("id", result.refundId).single();

    const body = refundEvent("refund.failed", {
      refundId: row!.razorpay_refund_id!,
      paymentId: order.paymentId,
      amount: result.amountPaise,
    });
    expect((await deliver(body)).body.result).toBe("refund_failed");
    expect((await orderRow(order.orderId)).needs_attention).toBe(true);
    expect(notify).toHaveBeenLastCalledWith([
      { type: "needs_attention", orderId: order.orderId, reason: expect.stringContaining(row!.razorpay_refund_id!) },
    ]);
  });

  it("completes a refund whose Server Action died after Razorpay accepted it", async () => {
    const order = await paidOrder([{ variant: variants[1], qty: 1 }]);
    const stock = (await variantState(variants[1].id)).stock;
    const { data: prepared, error } = await admin
      .rpc("prepare_refund", {
        p_order_id: order.orderId,
        p_kind: "cancel",
        p_items: [],
        p_include_shipping: true,
        p_reason: "Cancelled",
        p_actor_id: ownerId,
      })
      .single();
    if (error) throw error;

    const rzpRefundId = fakeRazorpayId("rfnd");
    const body = refundEvent("refund.processed", {
      refundId: rzpRefundId,
      paymentId: order.paymentId,
      amount: prepared!.amount_paise,
      notes: { order_number: prepared!.order_number, refund_id: prepared!.refund_id },
    });
    expect((await deliver(body)).body.result).toBe("refund_recovered");
    expect(await orderRow(order.orderId)).toMatchObject({ order_status: "cancelled", payment_status: "refunded" });
    expect(await creditNotes(order.orderId)).toHaveLength(1);
    expect((await variantState(variants[1].id)).stock).toBe(stock + 1);
    expect(stockChanged).toHaveBeenLastCalledWith([variants[1].productId]);
    expect(notify).toHaveBeenLastCalledWith([
      { type: "order_cancelled", orderId: order.orderId, refundId: prepared!.refund_id },
    ]);
  });

  it("ignores a refund that isn't ours", async () => {
    const body = refundEvent("refund.processed", {
      refundId: fakeRazorpayId("rfnd"),
      paymentId: fakeRazorpayId("pay"),
      amount: 1000,
    });
    expect((await deliver(body)).body.result).toBe("unknown_refund");
  });
});

// Sanity: the Kerala split stays CGST + SGST on a credit note.
describe("intra-state credit note", () => {
  it("splits tax into CGST and SGST", async () => {
    const order = await paidOrder([{ variant: variants[0], qty: 1 }], { address: ADDRESS_KERALA });
    await refund(order.orderId, "cancel");
    const [note] = await creditNotes(order.orderId);
    expect(note.totals.igst_paise).toBe(0);
    expect(note.totals.cgst_paise + note.totals.sgst_paise).toBeGreaterThan(0);
  });
});
