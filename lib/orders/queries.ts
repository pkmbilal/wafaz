import "server-only";
import { verifyOrderLinkToken } from "@/lib/orders/link-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type Courier, courierLabels, isCourier, trackingUrl } from "@/lib/shipping/tracking";

// Order reads for customers. The owner reads through RLS; a guest link (?t=) is verified first and
// then read with the service role, scoped to that one order id (AGENTS.md §5.8). Never cached.

export type OrderStatus = "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
export type PaymentStatus = "unpaid" | "paid" | "partially_refunded" | "refunded" | "failed";
export type FulfillmentStatus = "unfulfilled" | "packed" | "shipped" | "delivered" | "returned_to_origin";

export type OrderAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state_code: string;
  state_name: string;
  pincode: string;
};

export type OrderItemView = {
  id: string;
  productSlug: string;
  title: string;
  size: string;
  colour: string;
  imageKey: string | null;
  qty: number;
  unitPricePaise: number;
  lineNetPaise: number;
  lineDiscountPaise: number;
};

export type OrderView = {
  id: string;
  number: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  expiresAt: string | null;
  email: string;
  phone: string;
  shippingAddress: OrderAddress;
  couponCode: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  items: OrderItemView[];
  invoiceNumber: string | null;
  shipment: { courierName: string; trackingNumber: string; trackingUrl: string | null } | null;
  creditNotes: { id: string; number: string; issuedAt: string; totalPaise: number }[];
};

const ORDER_COLUMNS =
  "id, number, created_at, order_status, payment_status, fulfillment_status, expires_at, email, phone, " +
  "shipping_address, coupon_code, subtotal_paise, discount_paise, shipping_paise, total_paise, " +
  "cgst_paise, sgst_paise, igst_paise, " +
  "order_items(id, product_slug, product_title, size, colour, image_key, qty, unit_price_paise, line_net_paise, line_discount_paise), " +
  "invoices(number), shipments(courier, tracking_number), credit_notes(id, number, issued_at, totals)";

type OrderRow = {
  id: string;
  number: string;
  created_at: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  expires_at: string | null;
  email: string;
  phone: string;
  shipping_address: unknown;
  coupon_code: string | null;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  total_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  order_items: {
    id: string;
    product_slug: string;
    product_title: string;
    size: string;
    colour: string;
    image_key: string | null;
    qty: number;
    unit_price_paise: number;
    line_net_paise: number;
    line_discount_paise: number;
  }[];
  invoices: { number: string } | { number: string }[] | null;
  shipments: ShipmentRow | ShipmentRow[] | null;
  credit_notes: { id: string; number: string; issued_at: string; totals: { total_paise: number } }[];
};

type ShipmentRow = { courier: string; tracking_number: string };

function shipmentView(row: OrderRow["shipments"]): OrderView["shipment"] {
  const s = Array.isArray(row) ? row[0] : row;
  if (!s) return null;
  const courier: Courier = isCourier(s.courier) ? s.courier : "other";
  return {
    courierName: courierLabels[courier],
    trackingNumber: s.tracking_number,
    trackingUrl: trackingUrl(courier, s.tracking_number),
  };
}

function toView(row: OrderRow): OrderView {
  const invoice = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
  return {
    id: row.id,
    number: row.number,
    createdAt: row.created_at,
    orderStatus: row.order_status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    fulfillmentStatus: row.fulfillment_status as FulfillmentStatus,
    expiresAt: row.expires_at,
    email: row.email,
    phone: row.phone,
    shippingAddress: row.shipping_address as OrderAddress,
    couponCode: row.coupon_code,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    shippingPaise: row.shipping_paise,
    totalPaise: row.total_paise,
    cgstPaise: row.cgst_paise,
    sgstPaise: row.sgst_paise,
    igstPaise: row.igst_paise,
    items: row.order_items.map((i) => ({
      id: i.id,
      productSlug: i.product_slug,
      title: i.product_title,
      size: i.size,
      colour: i.colour,
      imageKey: i.image_key,
      qty: i.qty,
      unitPricePaise: i.unit_price_paise,
      lineNetPaise: i.line_net_paise,
      lineDiscountPaise: i.line_discount_paise,
    })),
    invoiceNumber: invoice?.number ?? null,
    shipment: shipmentView(row.shipments),
    creditNotes: [...(row.credit_notes ?? [])]
      .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
      .map((c) => ({ id: c.id, number: c.number, issuedAt: c.issued_at, totalPaise: c.totals.total_paise })),
  };
}

// The order if the current session owns it, or if `token` is a valid guest link for it.
export async function getOrderForViewer(orderId: string, token?: string): Promise<OrderView | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims.sub) {
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
    if (data) return toView(data as unknown as OrderRow);
  }

  if (!token) return null;
  // The token binds the order id to its email; look up only that email first.
  const admin = createAdminClient();
  const { data: contact } = await admin.from("orders").select("email").eq("id", orderId).maybeSingle();
  if (!contact || !verifyOrderLinkToken(orderId, contact.email, token)) return null;
  const { data } = await admin.from("orders").select(ORDER_COLUMNS).eq("id", orderId).single();
  return data ? toView(data as unknown as OrderRow) : null;
}

export type OrderListItem = {
  id: string;
  number: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalPaise: number;
  itemCount: number;
};

export async function getOrdersForUser(userId: string): Promise<OrderListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, created_at, order_status, payment_status, fulfillment_status, total_paise, order_items(qty)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data.map((o) => ({
    id: o.id,
    number: o.number,
    createdAt: o.created_at,
    orderStatus: o.order_status as OrderStatus,
    paymentStatus: o.payment_status as PaymentStatus,
    fulfillmentStatus: o.fulfillment_status as FulfillmentStatus,
    totalPaise: o.total_paise,
    itemCount: o.order_items.reduce((sum, i) => sum + i.qty, 0),
  }));
}
