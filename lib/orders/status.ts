import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/lib/orders/queries";

// Customer-facing wording for the three order statuses (DATA_MODEL §4).

export type TimelineStep = { key: string; label: string; state: "done" | "current" | "upcoming" };

export type StatusSummary = {
  headline: string;
  tone: "info" | "success" | "warning" | "neutral";
  steps: TimelineStep[];
};

type Statuses = { orderStatus: OrderStatus; paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus };

const FLOW: { key: string; label: string }[] = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Payment confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

// Index of the last step that is done; the next one is in progress.
function reached(s: Statuses): number {
  if (s.fulfillmentStatus === "delivered") return 4;
  if (s.fulfillmentStatus === "shipped" || s.fulfillmentStatus === "returned_to_origin") return 3;
  if (s.fulfillmentStatus === "packed") return 2;
  if (s.orderStatus === "confirmed" || s.orderStatus === "completed") return 1;
  return 0;
}

export function orderStatusSummary(s: Statuses): StatusSummary {
  const index = reached(s);
  const steps: TimelineStep[] = FLOW.map((step, i) => ({
    ...step,
    state: i <= index ? "done" : i === index + 1 ? "current" : "upcoming",
  }));

  if (s.paymentStatus === "refunded") return { headline: "Refunded", tone: "neutral", steps };
  if (s.orderStatus === "cancelled") return { headline: "Cancelled", tone: "neutral", steps };
  if (s.orderStatus === "expired") {
    return { headline: "Payment not received. This order has expired.", tone: "warning", steps };
  }
  if (s.orderStatus === "pending_payment") {
    return {
      headline: s.paymentStatus === "failed" ? "Payment failed" : "Awaiting payment",
      tone: "warning",
      steps,
    };
  }
  if (s.fulfillmentStatus === "returned_to_origin") return { headline: "Returned to us", tone: "neutral", steps };
  if (s.fulfillmentStatus === "delivered") return { headline: "Delivered", tone: "success", steps };
  if (s.fulfillmentStatus === "shipped") return { headline: "On its way", tone: "info", steps };
  if (s.fulfillmentStatus === "packed") return { headline: "Packed and ready to ship", tone: "info", steps };
  return { headline: "Order confirmed", tone: "success", steps };
}
