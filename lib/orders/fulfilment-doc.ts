import "server-only";
import type { OrderAddress } from "@/lib/orders/queries";
import { createClient } from "@/lib/supabase/server";
import { type Courier, courierLabels } from "@/lib/shipping/tracking";

// Data for the packing slip and shipping label (admin only). Read as the signed-in admin, so RLS
// applies; the route handlers check the role first.

export type FulfilmentDoc = {
  orderNumber: string;
  createdAt: string;
  totalWeightGrams: number;
  shipTo: OrderAddress;
  items: { title: string; colour: string; size: string; sku: string; qty: number }[];
  shipment: { courier: string; trackingNumber: string } | null;
  seller: {
    tradeName: string;
    legalName: string;
    addressLines: string[];
    phone: string;
  };
};

type Row = {
  number: string;
  created_at: string;
  total_weight_grams: number;
  shipping_address: OrderAddress;
  order_items: { product_title: string; colour: string; size: string; sku: string; qty: number; refunded_qty: number }[];
  shipments: { courier: Courier; tracking_number: string } | { courier: Courier; tracking_number: string }[] | null;
};

export async function getFulfilmentDoc(orderId: string): Promise<FulfilmentDoc | null> {
  const supabase = await createClient();
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "number, created_at, total_weight_grams, shipping_address, " +
          "order_items(product_title, colour, size, sku, qty, refunded_qty), shipments(courier, tracking_number)",
      )
      .eq("id", orderId)
      .maybeSingle<Row>(),
    supabase
      .from("store_settings")
      .select("trade_name, legal_name, address_line1, address_line2, city, state, pincode, support_phone")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  if (!order || !settings) return null;

  const shipment = Array.isArray(order.shipments) ? order.shipments[0] : order.shipments;
  return {
    orderNumber: order.number,
    createdAt: order.created_at,
    totalWeightGrams: order.total_weight_grams,
    shipTo: order.shipping_address,
    // Units already refunded aren't packed.
    items: order.order_items
      .map((i) => ({ title: i.product_title, colour: i.colour, size: i.size, sku: i.sku, qty: i.qty - i.refunded_qty }))
      .filter((i) => i.qty > 0)
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    shipment: shipment
      ? { courier: courierLabels[shipment.courier] ?? shipment.courier, trackingNumber: shipment.tracking_number }
      : null,
    seller: {
      tradeName: settings.trade_name,
      legalName: settings.legal_name,
      addressLines: [
        settings.address_line1,
        settings.address_line2 ?? "",
        `${settings.city}, ${settings.state} ${settings.pincode}`,
      ].filter(Boolean),
      phone: settings.support_phone,
    },
  };
}
