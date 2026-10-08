import "server-only";
import { AdminNeedsAttentionEmail } from "@/emails/admin-needs-attention";
import type { EmailSeller } from "@/emails/components";
import { LatePaymentRefundedEmail } from "@/emails/late-payment-refunded";
import { OrderConfirmedEmail } from "@/emails/order-confirmed";
import { type EmailOutcome, type EmailTransport, sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { orderLinkToken } from "@/lib/orders/link-token";
import type { OrderAddress } from "@/lib/orders/queries";
import { hashIdentifier } from "@/lib/request";
import type { createAdminClient } from "@/lib/supabase/admin";

// Order emails triggered by payment events. Data is read with the service role (called from the
// webhook, never from client code); links carry the signed guest token so they work without login.

type AdminClient = ReturnType<typeof createAdminClient>;

export type Notice =
  | { type: "order_confirmed"; orderId: string }
  | { type: "late_payment_refunded"; orderId: string; amountPaise: number }
  | { type: "needs_attention"; orderId: string; reason: string };

type Deps = { admin: AdminClient; transport?: EmailTransport | "dry_run" | "unconfigured" };

type Settings = EmailSeller & { alertEmail: string };

async function loadSettings(admin: AdminClient): Promise<Settings> {
  const { data, error } = await admin
    .from("store_settings")
    .select("legal_name, address_line1, address_line2, city, state, pincode, support_email, support_phone")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`store_settings: ${error.message}`);
  const addressLine = [data.address_line1, data.address_line2, `${data.city}, ${data.state} ${data.pincode}`]
    .filter(Boolean)
    .join(", ");
  return {
    legalName: data.legal_name,
    addressLine,
    supportEmail: data.support_email,
    supportPhone: data.support_phone,
    // TODO(owner): send admin alerts to a separate address instead of the support inbox?
    alertEmail: data.support_email,
  };
}

export function orderLinks(orderId: string, email: string) {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const t = encodeURIComponent(orderLinkToken(orderId, email));
  return {
    orderUrl: `${base}/orders/${orderId}?t=${t}`,
    invoiceUrl: `${base}/api/invoices/${orderId}?t=${t}`,
  };
}

export function addressLines(a: OrderAddress): string[] {
  return [a.name, a.line1, a.line2 ?? "", `${a.city}, ${a.state_name} ${a.pincode}`, a.phone].filter(Boolean);
}

export async function sendNotice(notice: Notice, deps: Deps): Promise<EmailOutcome> {
  const { admin, transport } = deps;
  const settings = await loadSettings(admin);
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, number, email, subtotal_paise, discount_paise, coupon_code, shipping_paise, total_paise, " +
        "cgst_paise, sgst_paise, igst_paise, shipping_address, " +
        "order_items(product_title, size, colour, qty, line_net_paise), invoices(number)",
    )
    .eq("id", notice.orderId)
    .single<{
      id: string;
      number: string;
      email: string;
      subtotal_paise: number;
      discount_paise: number;
      coupon_code: string | null;
      shipping_paise: number;
      total_paise: number;
      cgst_paise: number;
      sgst_paise: number;
      igst_paise: number;
      shipping_address: OrderAddress;
      order_items: { product_title: string; size: string; colour: string; qty: number; line_net_paise: number }[];
      invoices: { number: string } | { number: string }[] | null;
    }>();
  if (error) throw new Error(`order ${notice.orderId}: ${error.message}`);
  const customerName = order.shipping_address.name;

  switch (notice.type) {
    case "order_confirmed": {
      const links = orderLinks(order.id, order.email);
      const hasInvoice = Array.isArray(order.invoices) ? order.invoices.length > 0 : Boolean(order.invoices);
      return sendEmail(
        admin,
        {
          kind: "order_confirmed",
          dedupeKey: `order_confirmed:${order.id}`,
          orderId: order.id,
          to: order.email,
          replyTo: settings.supportEmail,
          subject: `Order ${order.number} confirmed`,
          react: (
            <OrderConfirmedEmail
              orderNumber={order.number}
              customerName={customerName}
              items={order.order_items.map((i) => ({
                title: i.product_title,
                variant: `${i.colour}, ${i.size}`,
                qty: i.qty,
                totalPaise: i.line_net_paise,
              }))}
              subtotalPaise={order.subtotal_paise}
              discountPaise={order.discount_paise}
              couponCode={order.coupon_code}
              shippingPaise={order.shipping_paise}
              totalPaise={order.total_paise}
              gstPaise={order.cgst_paise + order.sgst_paise + order.igst_paise}
              addressLines={addressLines(order.shipping_address)}
              orderUrl={links.orderUrl}
              invoiceUrl={hasInvoice ? links.invoiceUrl : null}
              seller={settings}
            />
          ),
        },
        transport,
      );
    }
    case "late_payment_refunded":
      return sendEmail(
        admin,
        {
          kind: "late_payment_refunded",
          dedupeKey: `late_payment_refunded:${order.id}`,
          orderId: order.id,
          to: order.email,
          replyTo: settings.supportEmail,
          subject: `Refund for order ${order.number}`,
          react: (
            <LatePaymentRefundedEmail
              orderNumber={order.number}
              customerName={customerName}
              amountPaise={notice.amountPaise}
              seller={settings}
            />
          ),
        },
        transport,
      );
    case "needs_attention": {
      const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
      return sendEmail(
        admin,
        {
          kind: "admin_needs_attention",
          // One alert per distinct reason on an order.
          dedupeKey: `admin_needs_attention:${order.id}:${hashIdentifier(notice.reason).slice(0, 16)}`,
          orderId: order.id,
          to: settings.alertEmail,
          subject: `Needs attention: order ${order.number}`,
          // TODO(M8): link straight to /admin/orders/[id] once the orders screen exists.
          react: <AdminNeedsAttentionEmail orderNumber={order.number} reason={notice.reason} adminUrl={`${base}/admin`} />,
        },
        transport,
      );
    }
  }
}

// Sends each notice independently; one failure doesn't stop the rest. Never throws.
export async function sendNotices(notices: Notice[], deps: Deps): Promise<void> {
  for (const notice of notices) {
    try {
      await sendNotice(notice, deps);
    } catch (e) {
      console.error(`[notifications] ${notice.type} failed`, e instanceof Error ? e.message : e);
    }
  }
}
