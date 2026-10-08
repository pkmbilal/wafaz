import "server-only";
import type { Notice } from "@/lib/notifications";
import type { createAdminClient } from "@/lib/supabase/admin";

// Refund orchestration (AGENTS.md §5.2, §5.4): prepare_refund records the refund and fixes the
// credit-note figures, the Razorpay Refunds API moves the money, then complete_refund issues the
// credit note and applies the stock and status effects. A Razorpay rejection calls fail_refund,
// which never takes a credit-note number. Used by the admin Server Actions; the webhook uses
// completeRefund() to recover a refund whose action died after Razorpay accepted it.

type AdminClient = ReturnType<typeof createAdminClient>;

export type RefundKind = "partial" | "cancel" | "rto";

export type RefundItem = { order_item_id: string; qty: number };

export type RazorpayRefund = (input: {
  paymentId: string;
  amountPaise: number;
  orderNumber: string;
  refundId: string;
}) => Promise<{ id: string; status: "processed" | "pending" }>;

export type RefundOutcome =
  | { ok: true; refundId: string; amountPaise: number; creditNoteNumber: string; productIds: string[]; notices: Notice[] }
  | { ok: false; error: string };

// DB error codes raised by the refund functions → admin-facing messages.
const REFUND_ERRORS: Record<string, string> = {
  "refund:in_progress": "Another refund for this order is still being processed.",
  "refund:invalid_reason": "Add a reason for the refund.",
  "refund:cannot_cancel": "Only confirmed orders that haven't shipped can be cancelled.",
  "refund:not_rto": "The order isn't marked as returned to origin.",
  "refund:not_refundable": "This order can't be refunded.",
  "refund:no_invoice": "This order has no tax invoice, so it can't be refunded here.",
  "refund:invalid_items": "Choose the items and quantities to refund.",
  "refund:qty_exceeds_remaining": "That's more than is left to refund on an item.",
  "refund:shipping_already_refunded": "Shipping has already been refunded.",
  "refund:shipping_needs_full_refund": "Shipping can only be refunded with the last of the items.",
  "refund:nothing_to_refund": "Nothing to refund.",
  "refund:no_payment": "No captured payment found for this order.",
};

export function refundErrorMessage(dbMessage: string): string {
  return REFUND_ERRORS[dbMessage] ?? "Couldn't process the refund. Please try again.";
}

export function refundNotices(kind: string, orderId: string, refundId: string): Notice[] {
  return kind === "cancel"
    ? [{ type: "order_cancelled", orderId, refundId }]
    : [{ type: "order_refunded", orderId, refundId }];
}

async function productIdsFor(admin: AdminClient, orderId: string): Promise<string[]> {
  const { data } = await admin.from("order_items").select("product_id").eq("order_id", orderId);
  return [...new Set((data ?? []).map((r) => r.product_id))];
}

// complete_refund + the follow-up data the caller needs. Throws on DB errors.
export async function completeRefund(
  admin: AdminClient,
  refundId: string,
  razorpayRefundId: string,
  status: "processed" | "pending",
) {
  const { data: creditNoteNumber, error } = await admin.rpc("complete_refund", {
    p_refund_id: refundId,
    p_razorpay_refund_id: razorpayRefundId,
    p_status: status,
  });
  if (error) throw new Error(`complete_refund: ${error.message}`);
  const { data: refund, error: readError } = await admin
    .from("refunds")
    .select("order_id, kind, amount_paise")
    .eq("id", refundId)
    .single();
  if (readError) throw new Error(`refund ${refundId}: ${readError.message}`);
  const restocked = refund.kind === "cancel" || refund.kind === "rto";
  return {
    creditNoteNumber,
    orderId: refund.order_id,
    amountPaise: refund.amount_paise,
    productIds: restocked ? await productIdsFor(admin, refund.order_id) : [],
    notices: refundNotices(refund.kind, refund.order_id, refundId),
  };
}

export async function runRefund(
  admin: AdminClient,
  input: {
    orderId: string;
    kind: RefundKind;
    items: RefundItem[];
    includeShipping: boolean;
    reason: string;
    actorId: string;
  },
  refund: RazorpayRefund,
): Promise<RefundOutcome> {
  const { data: prepared, error } = await admin
    .rpc("prepare_refund", {
      p_order_id: input.orderId,
      p_kind: input.kind,
      p_items: input.items,
      p_include_shipping: input.includeShipping,
      p_reason: input.reason,
      p_actor_id: input.actorId,
    })
    .single();
  if (error || !prepared) return { ok: false, error: refundErrorMessage(error?.message ?? "") };

  let accepted: { id: string; status: "processed" | "pending" };
  try {
    accepted = await refund({
      paymentId: prepared.razorpay_payment_id,
      amountPaise: prepared.amount_paise,
      orderNumber: prepared.order_number,
      refundId: prepared.refund_id,
    });
  } catch (e) {
    const message = razorpayErrorMessage(e);
    const { error: failError } = await admin.rpc("fail_refund", { p_refund_id: prepared.refund_id, p_error: message });
    if (failError) console.error("[refunds] fail_refund failed", failError.message);
    return { ok: false, error: `Razorpay rejected the refund: ${message}` };
  }

  try {
    const done = await completeRefund(admin, prepared.refund_id, accepted.id, accepted.status);
    return {
      ok: true,
      refundId: prepared.refund_id,
      amountPaise: done.amountPaise,
      creditNoteNumber: done.creditNoteNumber,
      productIds: done.productIds,
      notices: done.notices,
    };
  } catch (e) {
    // The money has moved but the DB step failed. Leave the refund 'initiated': the refund
    // webhook carries our refund id in its notes and completes it.
    console.error("[refunds] complete_refund failed after Razorpay accepted", e instanceof Error ? e.message : e);
    return {
      ok: false,
      error: `Razorpay accepted refund ${accepted.id}, but recording it failed. It will be completed when Razorpay's webhook arrives; check the order again shortly.`,
    };
  }
}

function razorpayErrorMessage(e: unknown): string {
  // The Razorpay SDK rejects with { statusCode, error: { description } }.
  if (e && typeof e === "object" && "error" in e) {
    const inner = (e as { error?: { description?: unknown } }).error;
    if (typeof inner?.description === "string") return inner.description.slice(0, 300);
  }
  return e instanceof Error ? e.message.slice(0, 300) : "unknown error";
}
