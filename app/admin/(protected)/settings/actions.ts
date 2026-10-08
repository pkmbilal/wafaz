"use server";

import { refresh, revalidateTag } from "next/cache";
import { type ActionResult, dbErrorMessage, firstIssue } from "@/lib/admin-actions";
import { requireOwner } from "@/lib/auth/guards";
import { cacheTags } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validators/admin-settings";

// Store settings (owner only; RLS allows only the owner to update store_settings too). New values
// apply to documents issued from now on: invoices and credit notes keep their frozen seller copy.
export async function saveSettings(input: unknown): Promise<ActionResult> {
  if (!(await requireOwner())) return { ok: false, error: "Only the owner can change store settings." };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const s = parsed.data;

  const supabase = await createClient();
  const { data: state } = await supabase.from("indian_states").select("name").eq("code", s.stateCode).maybeSingle();
  if (!state) return { ok: false, error: "Choose a state" };

  const { error } = await supabase
    .from("store_settings")
    .update({
      legal_name: s.legalName,
      trade_name: s.tradeName,
      gstin: s.gstin,
      address_line1: s.addressLine1,
      address_line2: s.addressLine2,
      city: s.city,
      state: state.name,
      state_code: s.stateCode,
      pincode: s.pincode,
      support_email: s.supportEmail,
      support_phone: s.supportPhone,
      grievance_officer_name: s.grievanceOfficerName,
      grievance_officer_email: s.grievanceOfficerEmail,
      grievance_officer_phone: s.grievanceOfficerPhone,
      invoice_prefix: s.invoicePrefix,
      credit_note_prefix: s.creditNotePrefix,
      tax_slab_basis: s.taxSlabBasis,
      shipping_tax_rate_bps: s.shippingTaxRate,
      low_stock_threshold: s.lowStockThreshold,
      new_badge_days: s.newBadgeDays,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: dbErrorMessage(error, "Couldn't save the settings. Please try again.") };

  // Footer, contact and policy pages read settings; product cards use new_badge_days.
  revalidateTag(cacheTags.settings, "max");
  revalidateTag(cacheTags.catalog, "max");
  refresh();
  return { ok: true, message: "Settings saved" };
}
