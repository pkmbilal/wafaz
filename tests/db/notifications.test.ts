import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EmailTransport } from "@/lib/email";
import { stubPublicEnv } from "../stubs/public-env";
import { adminClient, createCustomer, deleteUsers } from "./helpers";
import {
  addToCart,
  attachRazorpayOrder,
  createOrder,
  fakeRazorpayId,
  restoreStock,
  stockVariants,
  type StockedVariant,
} from "./order-helpers";

// Order emails and the invoice snapshot, end to end against the local stack: a real paid order
// goes through the webhook, then its notices are sent through a fake transport.

const SECRET = "whsec_test_webhook_secret";
const LINK_SECRET = "test-order-link-secret-0123456789abcdef";
const admin = adminClient();

let webhook: typeof import("@/lib/payments/razorpay-webhook");
let notifications: typeof import("@/lib/notifications");
let invoices: typeof import("@/lib/orders/invoice");
let linkToken: typeof import("@/lib/orders/link-token");
let pdf: typeof import("@/pdf/invoice");

let variants: StockedVariant[] = [];
const users: string[] = [];

beforeAll(async () => {
  stubPublicEnv();
  vi.stubEnv("ORDER_LINK_SECRET", LINK_SECRET);
  webhook = await import("@/lib/payments/razorpay-webhook");
  notifications = await import("@/lib/notifications");
  invoices = await import("@/lib/orders/invoice");
  linkToken = await import("@/lib/orders/link-token");
  pdf = await import("@/pdf/invoice");
  variants = await stockVariants(1, 50, 10);
});

afterAll(async () => {
  await restoreStock(variants);
  await deleteUsers(...users);
});

function recordingTransport(fail = false) {
  const sent: Parameters<EmailTransport>[0][] = [];
  const transport: EmailTransport = async (email) => {
    if (fail) throw new Error("resend: rate_limit_exceeded: slow down");
    sent.push(email);
    return { id: `msg_${randomUUID()}` };
  };
  return { sent, transport };
}

async function paidOrder() {
  const buyer = await createCustomer();
  users.push(buyer.id);
  await addToCart(buyer.client, variants[0].id, 1);
  const { data } = await createOrder(buyer.client, { email: buyer.email });
  const orderId = data!.order_id;
  const rzpOrderId = await attachRazorpayOrder(buyer.client, orderId);
  const rawBody = readFileSync(new URL("../fixtures/razorpay/payment.captured.json", import.meta.url), "utf8")
    .replace("{{RZP_ORDER_ID}}", rzpOrderId)
    .replace("{{PAYMENT_ID}}", fakeRazorpayId("pay"))
    .replace('"{{AMOUNT}}"', String(data!.total_paise));
  const notify = vi.fn();
  const result = await webhook.handleRazorpayWebhook(
    { rawBody, signature: createHmac("sha256", SECRET).update(rawBody).digest("hex"), eventId: `evt_${randomUUID()}` },
    { admin, webhookSecret: SECRET, refund: vi.fn(), notify },
  );
  expect(result.body.result).toBe("committed");
  return { orderId, email: buyer.email, client: buyer.client, notices: notify.mock.calls[0][0] };
}

async function emailRow(dedupeKey: string) {
  const { data } = await admin.from("email_events").select("*").eq("dedupe_key", dedupeKey).single();
  return data!;
}

describe("order emails", () => {
  it("sends the confirmation once, with working guest and invoice links", async () => {
    const order = await paidOrder();
    const { sent, transport } = recordingTransport();

    await notifications.sendNotices(order.notices, { admin, transport });
    await notifications.sendNotices(order.notices, { admin, transport });

    expect(sent).toHaveLength(1);
    const token = encodeURIComponent(linkToken.orderLinkToken(order.orderId, order.email, LINK_SECRET));
    expect(sent[0]).toMatchObject({ to: order.email, idempotencyKey: `order_confirmed:${order.orderId}` });
    expect(sent[0].html).toContain(`http://localhost:3000/orders/${order.orderId}?t=${token}`);
    expect(sent[0].html).toContain(`http://localhost:3000/api/invoices/${order.orderId}?t=${token}`);
    expect(sent[0].text).toMatch(/your order is confirmed/i);
    expect(sent[0].text).toMatch(/Total paid\s+₹/);

    const row = await emailRow(`order_confirmed:${order.orderId}`);
    expect(row).toMatchObject({ status: "sent", attempts: 1, order_id: order.orderId, error: null });
    expect(row.provider_message_id).toMatch(/^msg_/);
    expect(row.recipient_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(order.email);
  });

  it("records a failed send and succeeds on retry", async () => {
    const order = await paidOrder();
    const key = `order_confirmed:${order.orderId}`;

    expect(await notifications.sendNotice(order.notices[0], { admin, transport: recordingTransport(true).transport })).toBe("failed");
    expect(await emailRow(key)).toMatchObject({ status: "failed", error: expect.stringContaining("rate_limit") });

    const ok = recordingTransport();
    expect(await notifications.sendNotice(order.notices[0], { admin, transport: ok.transport })).toBe("sent");
    expect(ok.sent).toHaveLength(1);
    expect(await emailRow(key)).toMatchObject({ status: "sent", attempts: 2, error: null });
  });

  it("logs instead of sending in dry-run mode, and fails loudly when unconfigured", async () => {
    const order = await paidOrder();
    expect(await notifications.sendNotice(order.notices[0], { admin, transport: "dry_run" })).toBe("dry_run");
    expect((await emailRow(`order_confirmed:${order.orderId}`)).status).toBe("dry_run");

    const other = await paidOrder();
    expect(await notifications.sendNotice(other.notices[0], { admin, transport: "unconfigured" })).toBe("failed");
    expect((await emailRow(`order_confirmed:${other.orderId}`)).error).toContain("RESEND_API_KEY");
  });

  it("sends one admin alert per distinct reason", async () => {
    const order = await paidOrder();
    const { sent, transport } = recordingTransport();
    const alert = (reason: string) => ({ type: "needs_attention" as const, orderId: order.orderId, reason });

    await notifications.sendNotices([alert("Amount mismatch"), alert("Amount mismatch"), alert("Second payment")], {
      admin,
      transport,
    });
    expect(sent.map((e) => e.subject)).toEqual([expect.stringContaining("Needs attention"), expect.stringContaining("Needs attention")]);
    // Goes to the store's inbox, not the customer.
    expect(sent.every((e) => e.to !== order.email)).toBe(true);
  });

  it("hides the email log from customers", async () => {
    const order = await paidOrder();
    await notifications.sendNotice(order.notices[0], { admin, transport: "dry_run" });
    const { data } = await order.client.from("email_events").select("id");
    expect(data).toEqual([]);
  });
});

describe("invoice snapshot", () => {
  it("parses the stored invoice and renders it as a PDF", async () => {
    const order = await paidOrder();
    const { data } = await admin.from("invoices").select(invoices.INVOICE_COLUMNS).eq("order_id", order.orderId).single();
    const invoice = invoices.parseInvoiceRow(data);
    expect(invoice.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{5}$/);
    expect(invoice.lines.reduce((sum, l) => sum + l.total_paise, 0)).toBe(invoice.totals.total_paise);

    const buffer = await pdf.renderInvoicePdf(invoice);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000); // The first render loads and subsets the fonts.

  it("is readable by its customer through RLS and not by another", async () => {
    const order = await paidOrder();
    const { data: own } = await order.client.from("invoices").select(invoices.INVOICE_COLUMNS).eq("order_id", order.orderId);
    expect(own).toHaveLength(1);

    const stranger = await createCustomer();
    users.push(stranger.id);
    const { data: other } = await stranger.client.from("invoices").select("id").eq("order_id", order.orderId);
    expect(other).toEqual([]);
  });
});
