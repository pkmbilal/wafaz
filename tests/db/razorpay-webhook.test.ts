import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stubPublicEnv } from "../stubs/public-env";
import { adminClient, createCustomer, deleteUsers } from "./helpers";
import {
  addToCart,
  attachRazorpayOrder,
  backdateExpiry,
  createOrder,
  fakeRazorpayId,
  orderRow,
  restoreStock,
  setStock,
  stockVariants,
  type StockedVariant,
} from "./order-helpers";

const SECRET = "whsec_test_webhook_secret";
const admin = adminClient();

let handle: typeof import("@/lib/payments/razorpay-webhook").handleRazorpayWebhook;
let variants: StockedVariant[] = [];
const users: string[] = [];
const refund = vi.fn(async () => ({ id: fakeRazorpayId("rfnd"), status: "processed" as const }));
const stockChanged = vi.fn();

beforeAll(async () => {
  stubPublicEnv();
  ({ handleRazorpayWebhook: handle } = await import("@/lib/payments/razorpay-webhook"));
  variants = await stockVariants(2, 50, 6);
});

afterAll(async () => {
  await restoreStock(variants);
  await deleteUsers(...users);
});

// Fixture payloads in tests/fixtures/razorpay/, filled in and signed like Razorpay does.
function event(name: "payment.captured" | "payment.failed", values: { rzpOrderId: string; paymentId: string; amount: number }) {
  const raw = readFileSync(new URL(`../fixtures/razorpay/${name}.json`, import.meta.url), "utf8")
    .replace("{{RZP_ORDER_ID}}", values.rzpOrderId)
    .replace("{{PAYMENT_ID}}", values.paymentId)
    .replace('"{{AMOUNT}}"', String(values.amount));
  return raw;
}

function deliver(rawBody: string, opts: { eventId?: string; secret?: string } = {}) {
  const signature = createHmac("sha256", opts.secret ?? SECRET).update(rawBody).digest("hex");
  return handle(
    { rawBody, signature, eventId: opts.eventId ?? `evt_${randomUUID()}` },
    { admin, webhookSecret: SECRET, refund, onStockChanged: stockChanged },
  );
}

async function pendingOrder() {
  const buyer = await createCustomer();
  users.push(buyer.id);
  await addToCart(buyer.client, variants[0].id, 1);
  const { data } = await createOrder(buyer.client, { email: buyer.email });
  const rzpOrderId = await attachRazorpayOrder(buyer.client, data!.order_id);
  return { orderId: data!.order_id, total: data!.total_paise, rzpOrderId };
}

describe("Razorpay webhook", () => {
  it("rejects a bad signature before touching the DB", async () => {
    const order = await pendingOrder();
    const body = event("payment.captured", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total });
    const result = await deliver(body, { secret: "wrong" });
    expect(result.status).toBe(400);
    expect((await orderRow(order.orderId)).payment_status).toBe("unpaid");
  });

  it("confirms the order on payment.captured and ignores a duplicate event", async () => {
    const order = await pendingOrder();
    const body = event("payment.captured", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total });
    const eventId = `evt_${randomUUID()}`;

    const first = await deliver(body, { eventId });
    expect(first).toEqual({ status: 200, body: { ok: true, result: "committed" } });
    expect(await orderRow(order.orderId)).toMatchObject({ order_status: "confirmed", payment_status: "paid" });
    expect(stockChanged).toHaveBeenCalledWith([variants[0].productId]);

    const duplicate = await deliver(body, { eventId });
    expect(duplicate.body.result).toBe("duplicate");
    const { data: rows } = await admin.from("webhook_events").select("status").eq("event_id", eventId);
    expect(rows).toEqual([{ status: "processed" }]);
  });

  it("flags an amount mismatch and does not fulfil", async () => {
    const order = await pendingOrder();
    const body = event("payment.captured", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total - 100 });
    const result = await deliver(body);
    expect(result.body.result).toBe("amount_mismatch");
    expect(await orderRow(order.orderId)).toMatchObject({
      order_status: "pending_payment",
      payment_status: "unpaid",
      needs_attention: true,
    });
  });

  it("handles a failure followed by a success", async () => {
    const order = await pendingOrder();
    const failed = event("payment.failed", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total });
    expect((await deliver(failed)).body.result).toBe("payment_failed");
    expect((await orderRow(order.orderId)).payment_status).toBe("failed");

    const captured = event("payment.captured", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total });
    expect((await deliver(captured)).body.result).toBe("committed");
    expect((await orderRow(order.orderId)).payment_status).toBe("paid");
  });

  it("refunds a late payment when the stock is gone", async () => {
    const [scarce] = await stockVariants(1, 1, 8);
    try {
      const buyer = await createCustomer();
      users.push(buyer.id);
      await addToCart(buyer.client, scarce.id, 1);
      const { data } = await createOrder(buyer.client, { email: buyer.email });
      const rzpOrderId = await attachRazorpayOrder(buyer.client, data!.order_id);
      await backdateExpiry(data!.order_id);
      await admin.rpc("expire_pending_orders");
      await setStock(scarce.id, 0);

      const paymentId = fakeRazorpayId("pay");
      const result = await deliver(event("payment.captured", { rzpOrderId, paymentId, amount: data!.total_paise }));
      expect(result.body.result).toBe("late_refunded");
      expect(refund).toHaveBeenCalledWith(expect.objectContaining({ paymentId, amountPaise: data!.total_paise }));
      expect(await orderRow(data!.order_id)).toMatchObject({
        order_status: "expired",
        payment_status: "refunded",
        needs_attention: true,
      });
    } finally {
      await restoreStock([scarce]);
    }
  });

  it("records a processing failure and asks Razorpay to retry", async () => {
    const order = await pendingOrder();
    const body = event("payment.captured", { rzpOrderId: order.rzpOrderId, paymentId: fakeRazorpayId("pay"), amount: order.total });
    const eventId = `evt_${randomUUID()}`;
    // Every DB function call fails, as if the database were briefly unavailable.
    const broken = {
      webhookSecret: SECRET,
      refund,
      admin: new Proxy(admin, {
        get(target, prop, receiver) {
          if (prop === "rpc") return () => Promise.resolve({ data: null, error: { message: "boom", code: "XX000" } });
          return Reflect.get(target, prop, receiver);
        },
      }),
    };
    const result = await handle(
      { rawBody: body, signature: createHmac("sha256", SECRET).update(body).digest("hex"), eventId },
      broken,
    );
    expect(result.status).toBe(500);
    const { data: row } = await admin.from("webhook_events").select("status, error, attempts").eq("event_id", eventId).single();
    expect(row).toMatchObject({ status: "failed", attempts: 1 });
    expect(row!.error).toContain("boom");

    // The retry succeeds and the same row is reused.
    const retry = await deliver(body, { eventId });
    expect(retry.body.result).toBe("committed");
    const { data: after } = await admin.from("webhook_events").select("status, attempts").eq("event_id", eventId).single();
    expect(after).toEqual({ status: "processed", attempts: 2 });
  });
});
