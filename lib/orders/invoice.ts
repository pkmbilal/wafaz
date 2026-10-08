import "server-only";
import { z } from "zod";
import { verifyOrderLinkToken } from "@/lib/orders/link-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Tax invoice reads for the PDF route. The invoice row is the frozen snapshot written at payment
// capture (AGENTS.md §5.2): the PDF renders exactly these figures and never recalculates.

export const paise = z.number().int();

export const invoiceAddressSchema = z.object({
  name: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string().nullish(),
  city: z.string(),
  state_code: z.string(),
  state_name: z.string(),
  pincode: z.string(),
});

export const invoiceLineSchema = z.object({
  description: z.string(),
  sku: z.string().nullable(),
  hsn_code: z.string(),
  qty: z.number().int(),
  unit_price_paise: paise,
  discount_paise: paise,
  taxable_paise: paise,
  gst_rate_bps: z.number().int().nullable(),
  cgst_paise: paise,
  sgst_paise: paise,
  igst_paise: paise,
  total_paise: paise,
});

export const sellerSnapshotSchema = z.object({
  legal_name: z.string(),
  trade_name: z.string(),
  gstin: z.string().nullable(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  state_code: z.string(),
  pincode: z.string(),
  email: z.string(),
  phone: z.string(),
});

export const buyerSnapshotSchema = z.object({
  email: z.string(),
  phone: z.string(),
  billing_address: invoiceAddressSchema,
  shipping_address: invoiceAddressSchema,
});

const invoiceRowSchema = z.object({
  number: z.string(),
  issued_at: z.string(),
  place_of_supply_code: z.string(),
  seller_snapshot: sellerSnapshotSchema,
  buyer_snapshot: buyerSnapshotSchema,
  totals: z.object({
    subtotal_paise: paise,
    discount_paise: paise,
    shipping_paise: paise,
    total_paise: paise,
    taxable_total_paise: paise,
    cgst_paise: paise,
    sgst_paise: paise,
    igst_paise: paise,
    coupon_code: z.string().nullable(),
  }),
  lines: z.array(invoiceLineSchema),
  orders: z.object({ number: z.string() }),
});

export type InvoiceRow = z.infer<typeof invoiceRowSchema>;
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type InvoiceAddress = z.infer<typeof invoiceAddressSchema>;
export type SellerSnapshot = z.infer<typeof sellerSnapshotSchema>;

export const INVOICE_COLUMNS =
  "number, issued_at, place_of_supply_code, seller_snapshot, buyer_snapshot, totals, lines, orders!inner(number)";

// Validates the stored snapshot (a jsonb shape drift fails loudly instead of rendering a wrong invoice).
export function parseInvoiceRow(data: unknown): InvoiceRow {
  return invoiceRowSchema.parse(data);
}

// The order's invoice if the current session can read the order (owner or admin via RLS), or if
// `token` is a valid guest link for it. Null when there is no invoice or no access.
export async function getInvoiceForViewer(orderId: string, token?: string): Promise<InvoiceRow | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims.sub) {
    const { data } = await supabase.from("invoices").select(INVOICE_COLUMNS).eq("order_id", orderId).maybeSingle();
    if (data) return parseInvoiceRow(data);
  }

  if (!token) return null;
  const admin = createAdminClient();
  const { data: contact } = await admin.from("orders").select("email").eq("id", orderId).maybeSingle();
  if (!contact || !verifyOrderLinkToken(orderId, contact.email, token)) return null;
  const { data } = await admin.from("invoices").select(INVOICE_COLUMNS).eq("order_id", orderId).maybeSingle();
  return data ? parseInvoiceRow(data) : null;
}

// 'INV/26-27/00001' → 'INV-26-27-00001.pdf'
export function invoiceFileName(number: string): string {
  return `${number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}
