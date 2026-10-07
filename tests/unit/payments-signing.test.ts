import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { stubPublicEnv } from "../stubs/public-env";

let orderLinkToken: typeof import("@/lib/orders/link-token").orderLinkToken;
let verifyOrderLinkToken: typeof import("@/lib/orders/link-token").verifyOrderLinkToken;
let razorpay: typeof import("@/lib/razorpay");

beforeAll(async () => {
  stubPublicEnv();
  ({ orderLinkToken, verifyOrderLinkToken } = await import("@/lib/orders/link-token"));
  razorpay = await import("@/lib/razorpay");
});

const SECRET = "test_secret_value";

describe("Razorpay signatures", () => {
  it("verifies the checkout success signature", () => {
    const signature = createHmac("sha256", SECRET).update("order_ABC123|pay_XYZ789").digest("hex");
    const input = { razorpayOrderId: "order_ABC123", razorpayPaymentId: "pay_XYZ789", signature };
    expect(razorpay.verifyPaymentSignature(input, SECRET)).toBe(true);
    expect(razorpay.verifyPaymentSignature({ ...input, razorpayPaymentId: "pay_OTHER1" }, SECRET)).toBe(false);
    expect(razorpay.verifyPaymentSignature(input, "wrong")).toBe(false);
  });

  it("verifies the webhook signature on the raw body", () => {
    const body = '{"event":"payment.captured"}';
    const signature = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(razorpay.verifyWebhookSignature(body, signature, SECRET)).toBe(true);
    expect(razorpay.verifyWebhookSignature(body + " ", signature, SECRET)).toBe(false);
    expect(razorpay.verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(razorpay.safeEqualHex("abc", "abcd")).toBe(false);
  });
});

describe("guest order link token", () => {
  const LINK_SECRET = "x".repeat(32);

  it("binds the order id and email (case-insensitive)", () => {
    const token = orderLinkToken("order-1", "Asha@Example.com", LINK_SECRET);
    expect(verifyOrderLinkToken("order-1", "asha@example.com", token, LINK_SECRET)).toBe(true);
    expect(verifyOrderLinkToken("order-2", "asha@example.com", token, LINK_SECRET)).toBe(false);
    expect(verifyOrderLinkToken("order-1", "other@example.com", token, LINK_SECRET)).toBe(false);
    expect(verifyOrderLinkToken("order-1", "asha@example.com", "short", LINK_SECRET)).toBe(false);
  });
});
