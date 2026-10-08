"use server";

import { refresh, revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { type ActionResult, firstIssue } from "@/lib/admin-actions";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { cacheTags } from "@/lib/cache-tags";
import { type Notice, sendNotices } from "@/lib/notifications";
import { refundErrorMessage, runRefund } from "@/lib/orders/refunds";
import { refundPayment } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  failStuckRefundSchema,
  orderIdSchema,
  refundOrderSchema,
  refundPreviewSchema,
  resolveAttentionSchema,
  shipOrderSchema,
} from "@/lib/validators/admin-orders";

// Admin order actions. Each checks the role, validates its input, then calls one DB function with
// the service role (AGENTS.md §5.8); the functions validate the transition and log order_events.
// Staff can pack, ship, deliver and mark RTO; refunds and cancellations are owner-only (ROADMAP).

const NOT_ALLOWED = "That action isn't possible for this order's current status. Refresh and try again.";

function notify(admin: ReturnType<typeof createAdminClient>, notices: Notice[]) {
  if (notices.length > 0) after(() => sendNotices(notices, { admin }));
}

function revalidateStock(productIds: string[]) {
  for (const id of productIds) revalidateTag(cacheTags.product(id), "max");
  if (productIds.length > 0) revalidateTag(cacheTags.catalog, "max");
}

async function simpleTransition(
  orderId: unknown,
  call: (admin: ReturnType<typeof createAdminClient>, id: string, actorId: string) => PromiseLike<{ error: unknown }>,
  notice?: (id: string) => Notice,
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Order not found" };
  const admin = createAdminClient();
  const { error } = await call(admin, parsed.data, userId);
  if (error) return { ok: false, error: NOT_ALLOWED };
  if (notice) notify(admin, [notice(parsed.data)]);
  refresh();
  return { ok: true };
}

export async function markPacked(orderId: unknown): Promise<ActionResult> {
  return simpleTransition(orderId, (admin, id, actorId) =>
    admin.rpc("transition_order", {
      p_order_id: id,
      p_field: "fulfillment_status",
      p_to_value: "packed",
      p_actor_id: actorId,
    }),
  );
}

export async function markDelivered(orderId: unknown): Promise<ActionResult> {
  return simpleTransition(
    orderId,
    (admin, id, actorId) => admin.rpc("mark_order_delivered", { p_order_id: id, p_actor_id: actorId }),
    (id) => ({ type: "order_delivered", orderId: id }),
  );
}

export async function markRto(orderId: unknown): Promise<ActionResult> {
  return simpleTransition(orderId, (admin, id, actorId) =>
    admin.rpc("mark_order_rto", { p_order_id: id, p_actor_id: actorId }),
  );
}

export async function shipOrder(input: unknown): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = shipOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const admin = createAdminClient();
  const { error } = await admin.rpc("ship_order", {
    p_order_id: parsed.data.orderId,
    p_courier: parsed.data.courier,
    p_tracking_number: parsed.data.trackingNumber,
    p_actor_id: userId,
  });
  if (error) {
    return { ok: false, error: error.message === "refund:in_progress" ? refundErrorMessage(error.message) : NOT_ALLOWED };
  }
  notify(admin, [{ type: "order_shipped", orderId: parsed.data.orderId }]);
  refresh();
  return { ok: true };
}

export type RefundPreview =
  | { ok: true; amountPaise: number; full: boolean; lines: { description: string; qty: number; totalPaise: number }[] }
  | { ok: false; error: string };

export async function previewRefund(input: unknown): Promise<RefundPreview> {
  if (!(await requireOwner())) return { ok: false, error: "Only the owner can issue refunds." };
  const parsed = refundPreviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { data, error } = await createAdminClient().rpc("refund_preview", {
    p_order_id: parsed.data.orderId,
    p_items: parsed.data.items.map((i) => ({ order_item_id: i.orderItemId, qty: i.qty })),
    p_include_shipping: parsed.data.includeShipping,
  });
  if (error) return { ok: false, error: refundErrorMessage(error.message) };
  const preview = z
    .object({
      amount_paise: z.number().int(),
      full: z.boolean(),
      lines: z.array(z.object({ description: z.string(), qty: z.number().int(), total_paise: z.number().int() })),
    })
    .parse(data);
  return {
    ok: true,
    amountPaise: preview.amount_paise,
    full: preview.full,
    lines: preview.lines.map((l) => ({ description: l.description, qty: l.qty, totalPaise: l.total_paise })),
  };
}

// Partial refund, cancel-and-refund, or refund after a returned parcel is received.
export async function refundOrder(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only the owner can issue refunds." };
  const parsed = refundOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  const admin = createAdminClient();
  const outcome = await runRefund(
    admin,
    {
      orderId: data.orderId,
      kind: data.kind,
      items: data.kind === "partial" ? data.items.map((i) => ({ order_item_id: i.orderItemId, qty: i.qty })) : [],
      includeShipping: data.kind === "cancel" ? true : data.includeShipping,
      reason: data.reason,
      actorId: owner.userId,
    },
    refundPayment,
  );
  refresh();
  if (!outcome.ok) return outcome;

  revalidateStock(outcome.productIds);
  notify(admin, outcome.notices);
  return { ok: true, message: `Refund issued. Credit note ${outcome.creditNoteNumber}.` };
}

export async function resolveAttention(input: unknown): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = resolveAttentionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { error } = await createAdminClient().rpc("resolve_attention", {
    p_order_id: parsed.data.orderId,
    p_note: parsed.data.note,
    p_actor_id: userId,
  });
  if (error) return { ok: false, error: "This order isn't flagged any more." };
  refresh();
  return { ok: true };
}

// An 'initiated' refund whose Server Action died before Razorpay answered. The owner checks the
// Razorpay dashboard first: if Razorpay did refund, its webhook completes the refund instead.
export async function failStuckRefund(input: unknown): Promise<ActionResult> {
  if (!(await requireOwner())) return { ok: false, error: "Only the owner can change refunds." };
  const parsed = failStuckRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Refund not found" };
  const admin = createAdminClient();
  const { data: refund } = await admin
    .from("refunds")
    .select("created_at")
    .eq("id", parsed.data.refundId)
    .eq("order_id", parsed.data.orderId)
    .eq("status", "initiated")
    .maybeSingle();
  if (!refund) return { ok: false, error: "This refund isn't pending any more." };
  if (Date.now() - new Date(refund.created_at).getTime() < 10 * 60 * 1000) {
    return { ok: false, error: "Wait 10 minutes for Razorpay to confirm before clearing this refund." };
  }
  const { error } = await admin.rpc("fail_refund", {
    p_refund_id: parsed.data.refundId,
    p_error: "Cleared by owner: no refund found in Razorpay",
  });
  if (error) return { ok: false, error: "This refund isn't pending any more." };
  refresh();
  return { ok: true };
}
