import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/lib/orders/queries";

// Admin wording for the raw status values (DATA_MODEL §4).

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  partially_refunded: "Part refunded",
  refunded: "Refunded",
  failed: "Failed",
};

export const fulfillmentStatusLabels: Record<FulfillmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  returned_to_origin: "Returned (RTO)",
};

export const refundKindLabels: Record<string, string> = {
  auto: "Automatic (late payment)",
  partial: "Partial refund",
  cancel: "Cancellation",
  rto: "Returned parcel",
};

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function statusTone(value: string): StatusTone {
  switch (value) {
    case "paid":
    case "completed":
    case "delivered":
    case "processed":
      return "success";
    case "confirmed":
    case "packed":
    case "shipped":
      return "info";
    case "pending_payment":
    case "unfulfilled":
    case "partially_refunded":
    case "pending":
    case "initiated":
      return "warning";
    case "failed":
    case "returned_to_origin":
      return "danger";
    default:
      return "neutral";
  }
}
