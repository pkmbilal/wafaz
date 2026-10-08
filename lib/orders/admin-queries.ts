import "server-only";
import type { FulfillmentStatus, OrderAddress, OrderStatus, PaymentStatus } from "@/lib/orders/queries";
import { createClient } from "@/lib/supabase/server";
import { type Courier, isCourier } from "@/lib/shipping/tracking";
import { ORDERS_PAGE_SIZE, type OrderFilters } from "@/lib/validators/admin-orders";

// Admin reads. They run as the signed-in admin, so RLS (private.is_admin / is_owner) decides what
// comes back; the admin layout has already checked the role. Writes go through Server Actions.

type Statuses = { orderStatus: OrderStatus; paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus };

// An initiated refund older than this has lost its Server Action.
const STUCK_REFUND_MINUTES = 10;

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export type AdminOrderListItem = Statuses & {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  email: string;
  totalPaise: number;
  needsAttention: boolean;
};

export async function listAdminOrders(
  filters: OrderFilters,
): Promise<{ orders: AdminOrderListItem[]; total: number; page: number; pageCount: number }> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const from = (page - 1) * ORDERS_PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, number, created_at, email, total_paise, order_status, payment_status, fulfillment_status, needs_attention, shipping_address",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);
  if (filters.order) query = query.eq("order_status", filters.order);
  if (filters.payment) query = query.eq("payment_status", filters.payment);
  if (filters.fulfillment) query = query.eq("fulfillment_status", filters.fulfillment);
  if (filters.attention) query = query.eq("needs_attention", true);
  if (filters.q) {
    // q is limited to [A-Za-z0-9@.+_-] by the validator, so it can't break out of the filter.
    const q = filters.q;
    query = query.or(`number.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    orders: data.map((o) => ({
      id: o.id,
      number: o.number,
      createdAt: o.created_at,
      customerName: (o.shipping_address as OrderAddress).name,
      email: o.email,
      totalPaise: o.total_paise,
      orderStatus: o.order_status as OrderStatus,
      paymentStatus: o.payment_status as PaymentStatus,
      fulfillmentStatus: o.fulfillment_status as FulfillmentStatus,
      needsAttention: o.needs_attention,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
export type AdminOrderItem = {
  id: string;
  title: string;
  sku: string;
  size: string;
  colour: string;
  qty: number;
  refundedQty: number;
  unitPricePaise: number;
  lineNetPaise: number;
};

export type AdminRefund = {
  id: string;
  kind: string;
  amountPaise: number;
  status: string;
  reason: string;
  razorpayRefundId: string | null;
  error: string | null;
  createdAt: string;
  // 'initiated' for longer than STUCK_REFUND_MINUTES: its Server Action never finished.
  stuck: boolean;
  creditNote: { id: string; number: string } | null;
};

export type AdminOrderEvent = {
  id: string;
  field: string;
  from: string | null;
  to: string | null;
  note: string | null;
  bySystem: boolean;
  createdAt: string;
};

export type AdminOrder = Statuses & {
  id: string;
  number: string;
  createdAt: string;
  email: string;
  phone: string;
  needsAttention: boolean;
  attentionReason: string | null;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  couponCode: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalWeightGrams: number;
  invoice: { number: string; issuedAt: string } | null;
  items: AdminOrderItem[];
  payments: { razorpayPaymentId: string | null; razorpayOrderId: string; status: string; amountPaise: number; method: string | null }[];
  refunds: AdminRefund[];
  shippingRefunded: boolean;
  shipment: {
    courier: Courier;
    trackingNumber: string;
    shippedAt: string;
    deliveredAt: string | null;
    rtoAt: string | null;
    rtoReceivedAt: string | null;
  } | null;
  events: AdminOrderEvent[];
};

const DETAIL_COLUMNS =
  "id, number, created_at, email, phone, order_status, payment_status, fulfillment_status, needs_attention, " +
  "attention_reason, shipping_address, billing_address, coupon_code, subtotal_paise, discount_paise, " +
  "shipping_paise, total_paise, cgst_paise, sgst_paise, igst_paise, total_weight_grams, " +
  "invoices(number, issued_at), " +
  "order_items(id, product_title, sku, size, colour, qty, refunded_qty, unit_price_paise, line_net_paise), " +
  "payments(razorpay_payment_id, razorpay_order_id, status, amount_paise, method, created_at), " +
  "refunds(id, kind, amount_paise, status, reason, razorpay_refund_id, error, include_shipping, created_at, credit_notes(id, number)), " +
  "shipments(courier, tracking_number, shipped_at, delivered_at, rto_at, rto_received_at), " +
  "order_events(id, field, from_value, to_value, note, actor_id, created_at)";

type DetailRow = {
  id: string;
  number: string;
  created_at: string;
  email: string;
  phone: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  needs_attention: boolean;
  attention_reason: string | null;
  shipping_address: OrderAddress;
  billing_address: OrderAddress;
  coupon_code: string | null;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  total_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_weight_grams: number;
  invoices: { number: string; issued_at: string } | { number: string; issued_at: string }[] | null;
  order_items: {
    id: string;
    product_title: string;
    sku: string;
    size: string;
    colour: string;
    qty: number;
    refunded_qty: number;
    unit_price_paise: number;
    line_net_paise: number;
  }[];
  payments: {
    razorpay_payment_id: string | null;
    razorpay_order_id: string;
    status: string;
    amount_paise: number;
    method: string | null;
    created_at: string;
  }[];
  refunds: {
    id: string;
    kind: string;
    amount_paise: number;
    status: string;
    reason: string;
    razorpay_refund_id: string | null;
    error: string | null;
    include_shipping: boolean;
    created_at: string;
    credit_notes: { id: string; number: string } | { id: string; number: string }[] | null;
  }[];
  shipments: ShipmentRow | ShipmentRow[] | null;
  order_events: {
    id: string;
    field: string;
    from_value: string | null;
    to_value: string | null;
    note: string | null;
    actor_id: string | null;
    created_at: string;
  }[];
};

type ShipmentRow = {
  courier: string;
  tracking_number: string;
  shipped_at: string;
  delivered_at: string | null;
  rto_at: string | null;
  rto_received_at: string | null;
};

export async function getAdminOrder(orderId: string): Promise<AdminOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(DETAIL_COLUMNS).eq("id", orderId).maybeSingle<DetailRow>();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const invoice = one(data.invoices);
  const shipment = one(data.shipments);
  const byDate = (a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at);

  return {
    id: data.id,
    number: data.number,
    createdAt: data.created_at,
    email: data.email,
    phone: data.phone,
    orderStatus: data.order_status as OrderStatus,
    paymentStatus: data.payment_status as PaymentStatus,
    fulfillmentStatus: data.fulfillment_status as FulfillmentStatus,
    needsAttention: data.needs_attention,
    attentionReason: data.attention_reason,
    shippingAddress: data.shipping_address,
    billingAddress: data.billing_address,
    couponCode: data.coupon_code,
    subtotalPaise: data.subtotal_paise,
    discountPaise: data.discount_paise,
    shippingPaise: data.shipping_paise,
    totalPaise: data.total_paise,
    cgstPaise: data.cgst_paise,
    sgstPaise: data.sgst_paise,
    igstPaise: data.igst_paise,
    totalWeightGrams: data.total_weight_grams,
    invoice: invoice ? { number: invoice.number, issuedAt: invoice.issued_at } : null,
    items: data.order_items
      .map((i) => ({
        id: i.id,
        title: i.product_title,
        sku: i.sku,
        size: i.size,
        colour: i.colour,
        qty: i.qty,
        refundedQty: i.refunded_qty,
        unitPricePaise: i.unit_price_paise,
        lineNetPaise: i.line_net_paise,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    payments: [...data.payments].sort(byDate).map((p) => ({
      razorpayPaymentId: p.razorpay_payment_id,
      razorpayOrderId: p.razorpay_order_id,
      status: p.status,
      amountPaise: p.amount_paise,
      method: p.method,
    })),
    refunds: [...data.refunds].sort(byDate).map((r) => ({
      id: r.id,
      kind: r.kind,
      amountPaise: r.amount_paise,
      status: r.status,
      reason: r.reason,
      razorpayRefundId: r.razorpay_refund_id,
      error: r.error,
      createdAt: r.created_at,
      stuck: r.status === "initiated" && Date.parse(r.created_at) < Date.now() - STUCK_REFUND_MINUTES * 60 * 1000,
      creditNote: one(r.credit_notes),
    })),
    shippingRefunded: data.refunds.some((r) => r.include_shipping && r.status !== "failed"),
    shipment:
      shipment && isCourier(shipment.courier)
        ? {
            courier: shipment.courier,
            trackingNumber: shipment.tracking_number,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            rtoAt: shipment.rto_at,
            rtoReceivedAt: shipment.rto_received_at,
          }
        : null,
    events: [...data.order_events].sort(byDate).map((e) => ({
      id: e.id,
      field: e.field,
      from: e.from_value,
      to: e.to_value,
      note: e.note,
      bySystem: e.actor_id === null,
      createdAt: e.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export type Dashboard = {
  today: { orders: number; revenuePaise: number };
  toShip: number;
  attentionOrders: { id: string; number: string; reason: string | null; createdAt: string }[];
  stuckRefunds: { orderId: string; orderNumber: string; amountPaise: number; createdAt: string }[];
  failedWebhooks: { id: string; eventType: string; error: string | null; createdAt: string }[];
  failedEmails: { orderId: string | null; orderNumber: string | null; kind: string; error: string | null; createdAt: string }[];
  failedOtpSends: number;
  lowStock: { variantId: string; productTitle: string; sku: string; size: string; colour: string; available: number }[];
};

// Midnight today in India, as an ISO timestamp.
export function istMidnight(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  return `${day}T00:00:00+05:30`;
}

// Paid orders today, as gross revenue before refunds.
const PAID_STATUSES = ["paid", "partially_refunded", "refunded"];

export async function getDashboard(): Promise<Dashboard> {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stuckBefore = new Date(Date.now() - STUCK_REFUND_MINUTES * 60 * 1000).toISOString();

  const [today, toShip, attention, stuck, webhooks, emails, otp, lowStock] = await Promise.all([
    supabase.from("orders").select("total_paise").gte("created_at", istMidnight()).in("payment_status", PAID_STATUSES),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_status", "confirmed")
      .in("fulfillment_status", ["unfulfilled", "packed"])
      .in("payment_status", ["paid", "partially_refunded"]),
    supabase
      .from("orders")
      .select("id, number, attention_reason, created_at")
      .eq("needs_attention", true)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("refunds")
      .select("order_id, amount_paise, created_at, orders!inner(number)")
      .eq("status", "initiated")
      .lt("created_at", stuckBefore)
      .limit(20),
    // Owner only (RLS); staff get an empty list.
    supabase
      .from("webhook_events")
      .select("id, event_type, error, created_at")
      .eq("status", "failed")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_events")
      .select("order_id, kind, error, created_at, orders(number)")
      .eq("status", "failed")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    // Owner only (RLS).
    supabase
      .from("auth_hook_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    supabase.rpc("admin_low_stock"),
  ]);

  for (const result of [today, toShip, attention, stuck, webhooks, emails, otp, lowStock]) {
    if (result.error) throw new Error(result.error.message);
  }

  const paidToday = today.data ?? [];
  return {
    today: { orders: paidToday.length, revenuePaise: paidToday.reduce((sum, o) => sum + o.total_paise, 0) },
    toShip: toShip.count ?? 0,
    attentionOrders: (attention.data ?? []).map((o) => ({
      id: o.id,
      number: o.number,
      reason: o.attention_reason,
      createdAt: o.created_at,
    })),
    stuckRefunds: (stuck.data ?? []).map((r) => ({
      orderId: r.order_id,
      orderNumber: r.orders.number,
      amountPaise: r.amount_paise,
      createdAt: r.created_at,
    })),
    failedWebhooks: (webhooks.data ?? []).map((w) => ({
      id: w.id,
      eventType: w.event_type,
      error: w.error,
      createdAt: w.created_at,
    })),
    failedEmails: (emails.data ?? []).map((e) => ({
      orderId: e.order_id,
      orderNumber: e.orders?.number ?? null,
      kind: e.kind,
      error: e.error,
      createdAt: e.created_at,
    })),
    failedOtpSends: otp.count ?? 0,
    lowStock: (lowStock.data ?? []).map((v) => ({
      variantId: v.variant_id,
      productTitle: v.product_title,
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      available: v.available,
    })),
  };
}
