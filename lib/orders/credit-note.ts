import "server-only";
import { z } from "zod";
import {
  buyerSnapshotSchema,
  invoiceFileName,
  invoiceLineSchema,
  paise,
  sellerSnapshotSchema,
} from "@/lib/orders/invoice";
import { verifyOrderLinkToken } from "@/lib/orders/link-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Credit note reads for the PDF route. Like the invoice, the row is a frozen snapshot written when
// the refund was accepted (complete_refund); the seller and buyer details come from the original
// invoice it refers to.

const creditNoteRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  issued_at: z.string(),
  reason: z.string(),
  totals: z.object({
    items_paise: paise,
    shipping_paise: paise,
    total_paise: paise,
    taxable_total_paise: paise,
    cgst_paise: paise,
    sgst_paise: paise,
    igst_paise: paise,
  }),
  lines: z.array(invoiceLineSchema),
  invoices: z.object({
    number: z.string(),
    issued_at: z.string(),
    place_of_supply_code: z.string(),
    seller_snapshot: sellerSnapshotSchema,
    buyer_snapshot: buyerSnapshotSchema,
  }),
  orders: z.object({ number: z.string() }),
});

export type CreditNoteRow = z.infer<typeof creditNoteRowSchema>;

const CREDIT_NOTE_COLUMNS =
  "id, number, issued_at, reason, totals, lines, " +
  "invoices!inner(number, issued_at, place_of_supply_code, seller_snapshot, buyer_snapshot), orders!inner(number)";

export function parseCreditNoteRow(data: unknown): CreditNoteRow {
  return creditNoteRowSchema.parse(data);
}

// The credit note if the current session can read its order (owner or admin via RLS), or if `token`
// is a valid guest link for that order.
export async function getCreditNoteForViewer(creditNoteId: string, token?: string): Promise<CreditNoteRow | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims.sub) {
    const { data } = await supabase.from("credit_notes").select(CREDIT_NOTE_COLUMNS).eq("id", creditNoteId).maybeSingle();
    if (data) return parseCreditNoteRow(data);
  }

  if (!token) return null;
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("credit_notes")
    .select("order_id, orders!inner(email)")
    .eq("id", creditNoteId)
    .maybeSingle();
  if (!link || !verifyOrderLinkToken(link.order_id, link.orders.email, token)) return null;
  const { data } = await admin.from("credit_notes").select(CREDIT_NOTE_COLUMNS).eq("id", creditNoteId).single();
  return data ? parseCreditNoteRow(data) : null;
}

export const creditNoteFileName = invoiceFileName;
