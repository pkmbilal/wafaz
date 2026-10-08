import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// Razorpay Standard Checkout (AGENTS.md §5.4). Secrets never leave the server or reach logs.

let client: Razorpay | undefined;

function razorpay(): Razorpay {
  const keyId = publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set");
  client ??= new Razorpay({ key_id: keyId, key_secret: serverEnv().RAZORPAY_KEY_SECRET });
  return client;
}

export function razorpayConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Checkout success handler: HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET).
export function verifyPaymentSignature(
  input: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  secret: string = serverEnv().RAZORPAY_KEY_SECRET,
): boolean {
  return safeEqualHex(hmacHex(secret, `${input.razorpayOrderId}|${input.razorpayPaymentId}`), input.signature);
}

// Webhook: HMAC_SHA256 of the raw request body with the webhook secret.
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string = serverEnv().RAZORPAY_WEBHOOK_SECRET,
): boolean {
  if (!signature) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

// The amount always comes from the DB order total, never from the client.
export async function createRazorpayOrder(input: { amountPaise: number; receipt: string; orderId: string }) {
  const order = await razorpay().orders.create({
    amount: input.amountPaise,
    currency: "INR",
    receipt: input.receipt,
    notes: { order_id: input.orderId },
  });
  return { id: order.id, amount: Number(order.amount) };
}

// `refundId` (our refunds row) goes into the notes so the refund webhook can finish a refund whose
// Server Action died after Razorpay accepted it.
export async function refundPayment(input: {
  paymentId: string;
  amountPaise: number;
  orderNumber: string;
  refundId?: string;
}) {
  const refund = await razorpay().payments.refund(input.paymentId, {
    amount: input.amountPaise,
    speed: "normal",
    notes: input.refundId
      ? { order_number: input.orderNumber, refund_id: input.refundId }
      : { order_number: input.orderNumber },
  });
  return { id: refund.id, status: refund.status === "processed" ? ("processed" as const) : ("pending" as const) };
}
