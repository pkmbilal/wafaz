import "server-only";
import { z } from "zod";
import type { Notice } from "@/lib/notifications";
import { completeRefund } from "@/lib/orders/refunds";
import { reportError } from "@/lib/observability";
import { verifyWebhookSignature } from "@/lib/razorpay";
import type { createAdminClient } from "@/lib/supabase/admin";

// Razorpay webhook processing (AGENTS.md §5.4 step 4). The webhook is the source of truth for
// payments. Kept separate from the route handler so tests can drive it with fixture payloads.

type AdminClient = ReturnType<typeof createAdminClient>;

export type WebhookDeps = {
  admin: AdminClient;
  webhookSecret?: string;
  refund: (input: { paymentId: string; amountPaise: number; orderNumber: string }) => Promise<{
    id: string;
    status: "processed" | "pending";
  }>;
  // Product ids whose stock changed, for revalidateTag.
  onStockChanged?: (productIds: string[]) => void;
  // Emails to send once the event is processed. Called only on success, after the event is
  // marked processed, so a retry (which skips processed events) never re-notifies.
  notify?: (notices: Notice[]) => void;
};

export type WebhookResult = { status: number; body: { ok: boolean; result?: string; error?: string } };

const paymentEntitySchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number().int(),
  method: z.string().nullish(),
  error_description: z.string().nullish(),
});

const refundEntitySchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.number().int(),
  // Razorpay sends an empty array when a refund has no notes.
  notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
});

const eventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z.object({ entity: paymentEntitySchema.partial().passthrough() }).optional(),
      refund: z.object({ entity: refundEntitySchema }).optional(),
    })
    .passthrough(),
});

type PaymentEntity = z.infer<typeof paymentEntitySchema>;
type RefundEntity = z.infer<typeof refundEntitySchema>;

class WebhookError extends Error {}

export async function handleRazorpayWebhook(
  request: { rawBody: string; signature: string | null; eventId: string | null },
  deps: WebhookDeps,
): Promise<WebhookResult> {
  // 1. Verify the signature on the raw body before parsing anything.
  if (!verifyWebhookSignature(request.rawBody, request.signature, deps.webhookSecret)) {
    return { status: 400, body: { ok: false, error: "invalid signature" } };
  }
  if (!request.eventId || request.eventId.length > 100) {
    return { status: 400, body: { ok: false, error: "missing event id" } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(request.rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid json" } };
  }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return { status: 400, body: { ok: false, error: "unexpected payload" } };
  const event = parsed.data;

  // 2. Idempotency: one row per x-razorpay-event-id.
  const { admin } = deps;
  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, attempts")
    .eq("event_id", request.eventId)
    .maybeSingle();
  if (existing?.status === "processed") return { status: 200, body: { ok: true, result: "duplicate" } };

  let rowId = existing?.id;
  if (existing) {
    await admin.from("webhook_events").update({ attempts: existing.attempts + 1 }).eq("id", existing.id);
  } else {
    const { data: inserted, error } = await admin
      .from("webhook_events")
      .insert({
        event_id: request.eventId,
        event_type: event.event,
        payload: payload as never,
        attempts: 1,
      })
      .select("id")
      .single();
    if (error) {
      // Usually a concurrent delivery of the same event inserted first; let Razorpay retry.
      if (error.code !== "23505") reportError("razorpay-webhook", error, { stage: "insert", event: event.event });
      return { status: 500, body: { ok: false, error: "event insert failed" } };
    }
    rowId = inserted.id;
  }

  // 3. Process, then record the outcome.
  try {
    const notices: Notice[] = [];
    const result = event.event.startsWith("refund.")
      ? await processRefundEvent(event.event, event.payload.refund?.entity, deps, notices)
      : await processEvent(event.event, event.payload.payment?.entity, deps, notices);
    await admin
      .from("webhook_events")
      .update({ status: "processed", error: null, processed_at: new Date().toISOString() })
      .eq("id", rowId!);
    if (notices.length > 0) deps.notify?.(notices);
    return { status: 200, body: { ok: true, result } };
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 2000) : "unknown error";
    await admin.from("webhook_events").update({ status: "failed", error: message }).eq("id", rowId!);
    console.error("[razorpay-webhook] processing failed", event.event);
    reportError("razorpay-webhook", e, { stage: "process", event: event.event, eventId: request.eventId });
    return { status: 500, body: { ok: false, error: "processing failed" } };
  }
}

async function flag(admin: AdminClient, notices: Notice[], orderId: string, reason: string) {
  const { data } = await admin.from("orders").select("attention_reason").eq("id", orderId).single();
  const combined = [data?.attention_reason, reason].filter(Boolean).join("; ").slice(0, 500);
  const { error } = await admin
    .from("orders")
    .update({ needs_attention: true, attention_reason: combined })
    .eq("id", orderId);
  if (error) throw new WebhookError(`flag failed: ${error.message}`);
  notices.push({ type: "needs_attention", orderId, reason });
}

async function productIdsFor(admin: AdminClient, orderId: string): Promise<string[]> {
  const { data } = await admin.from("order_items").select("product_id").eq("order_id", orderId);
  return [...new Set((data ?? []).map((r) => r.product_id))];
}

// refund.processed / refund.failed update refunds the admin started (or the late-payment auto
// refund). A refund still 'initiated' (its Server Action died after Razorpay accepted it) is found
// by the refund id in its notes and completed here.
async function processRefundEvent(
  type: string,
  refund: RefundEntity | undefined,
  deps: WebhookDeps,
  notices: Notice[],
): Promise<string> {
  if (type !== "refund.processed" && type !== "refund.failed" && type !== "refund.created") return "ignored";
  if (!refund) throw new WebhookError("refund entity missing");
  const { admin } = deps;

  const { data: known } = await admin.from("refunds").select("id").eq("razorpay_refund_id", refund.id).maybeSingle();
  if (!known) {
    const notes = refund.notes && !Array.isArray(refund.notes) ? refund.notes : {};
    const ourId = z.uuid().safeParse(notes.refund_id);
    if (!ourId.success) return "unknown_refund";
    const { data: initiated } = await admin
      .from("refunds")
      .select("id, order_id, amount_paise")
      .eq("id", ourId.data)
      .eq("status", "initiated")
      .maybeSingle();
    if (!initiated) return "unknown_refund";
    if (initiated.amount_paise !== refund.amount) {
      await flag(admin, notices, initiated.order_id, `Refund ${refund.id} amount ${refund.amount} doesn't match our record`);
      return "amount_mismatch";
    }
    if (type === "refund.failed") {
      const { error } = await admin.rpc("fail_refund", { p_refund_id: initiated.id, p_error: "Razorpay refund failed" });
      if (error) throw new WebhookError(`fail_refund: ${error.message}`);
      notices.push({ type: "needs_attention", orderId: initiated.order_id, reason: `Refund ${refund.id} failed` });
      return "refund_failed";
    }
    try {
      const done = await completeRefund(admin, initiated.id, refund.id, type === "refund.processed" ? "processed" : "pending");
      if (done.productIds.length > 0) deps.onStockChanged?.(done.productIds);
      notices.push(...done.notices);
    } catch (e) {
      throw new WebhookError(e instanceof Error ? e.message : "complete_refund failed");
    }
    return "refund_recovered";
  }

  if (type === "refund.created") return "ignored";
  const status = type === "refund.processed" ? "processed" : "failed";
  const { data: orderId, error } = await admin.rpc("record_refund_status", {
    p_razorpay_refund_id: refund.id,
    p_status: status,
  });
  if (error) throw new WebhookError(`record_refund_status: ${error.message}`);
  if (status === "failed" && orderId) {
    notices.push({ type: "needs_attention", orderId, reason: `Razorpay refund ${refund.id} failed` });
  }
  return `refund_${status}`;
}

async function processEvent(
  type: string,
  rawPayment: unknown,
  deps: WebhookDeps,
  notices: Notice[],
): Promise<string> {
  if (type !== "payment.captured" && type !== "payment.failed") return "ignored";
  const parsedPayment = paymentEntitySchema.safeParse(rawPayment);
  if (!parsedPayment.success) throw new WebhookError("payment entity missing");
  const payment: PaymentEntity = parsedPayment.data;
  const { admin } = deps;

  const { data: link } = await admin
    .from("payments")
    .select("order_id, orders!inner(id, number, order_status, payment_status, total_paise)")
    .eq("razorpay_order_id", payment.order_id)
    .maybeSingle();
  if (!link) {
    // Not one of ours (or created outside checkout); nothing to retry.
    return "unknown_order";
  }
  const order = link.orders;

  if (type === "payment.failed") {
    const { error } = await admin.rpc("mark_payment_failed", {
      p_order_id: order.id,
      p_razorpay_order_id: payment.order_id,
      p_razorpay_payment_id: payment.id,
      p_raw: payment as never,
    });
    if (error) throw new WebhookError(`mark_payment_failed: ${error.message}`);
    return "payment_failed";
  }

  // payment.captured: the amount must match the DB order before anything is fulfilled.
  if (payment.amount !== order.total_paise) {
    await flag(admin, notices, order.id, `Amount mismatch: paid ${payment.amount} paise, order total ${order.total_paise}`);
    return "amount_mismatch";
  }

  const args = {
    p_order_id: order.id,
    p_razorpay_order_id: payment.order_id,
    p_razorpay_payment_id: payment.id,
    p_amount_paise: payment.amount,
    p_method: payment.method ?? undefined,
    p_raw: payment as never,
  };

  if (order.order_status === "pending_payment" || order.order_status === "confirmed") {
    const { data, error } = await admin.rpc("commit_order_payment", args);
    if (!error) {
      if (data === "committed") {
        deps.onStockChanged?.(await productIdsFor(admin, order.id));
        notices.push({ type: "order_confirmed", orderId: order.id });
      }
      return data ?? "committed";
    }
    if (error.message !== "payment:not_pending") throw new WebhookError(`commit: ${error.message}`);
    // Confirmed by a different payment: the customer paid twice.
    const { data: fresh } = await admin.from("orders").select("order_status").eq("id", order.id).single();
    if (fresh?.order_status !== "expired") {
      await flag(admin, notices, order.id, `Second payment ${payment.id} captured for an order that is ${fresh?.order_status}`);
      return "flagged";
    }
  } else if (order.order_status !== "expired") {
    await flag(admin, notices, order.id, `Payment ${payment.id} captured for a ${order.order_status} order`);
    return "flagged";
  }

  // 5. Late payment: the order expired before the capture arrived.
  const { data: committed, error: lateError } = await admin.rpc("late_payment_commit", args);
  if (lateError) throw new WebhookError(`late_payment_commit: ${lateError.message}`);
  if (committed) {
    deps.onStockChanged?.(await productIdsFor(admin, order.id));
    notices.push({ type: "order_confirmed", orderId: order.id });
    return "late_committed";
  }

  // No stock left: refund in full. No invoice was issued, so there is no credit note.
  const refund = await deps.refund({ paymentId: payment.id, amountPaise: payment.amount, orderNumber: order.number });
  const { error: refundError } = await admin.rpc("record_auto_refund", {
    p_order_id: order.id,
    p_razorpay_payment_id: payment.id,
    p_razorpay_refund_id: refund.id,
    p_amount_paise: payment.amount,
    p_status: refund.status,
  });
  if (refundError) throw new WebhookError(`record_auto_refund: ${refundError.message}`);
  notices.push(
    { type: "late_payment_refunded", orderId: order.id, amountPaise: payment.amount },
    { type: "needs_attention", orderId: order.id, reason: `Late payment ${payment.id} refunded automatically: items sold out` },
  );
  return "late_refunded";
}
