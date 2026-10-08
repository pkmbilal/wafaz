import "server-only";
import { bpsToPercentInput } from "@/lib/catalog/admin-input";
import { createClient } from "@/lib/supabase/server";
import type { SettingsInput } from "@/lib/validators/admin-settings";

// Admin reads for settings, coupons and account deletion requests. They run as the signed-in
// admin, so RLS decides what comes back.

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------
export async function getAdminSettings(): Promise<SettingsInput> {
  const supabase = await createClient();
  const { data: s, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  const national = (phone: string) => phone.replace(/^\+91/, "");
  return {
    legalName: s.legal_name,
    tradeName: s.trade_name,
    gstin: s.gstin ?? "",
    addressLine1: s.address_line1,
    addressLine2: s.address_line2 ?? "",
    city: s.city,
    stateCode: s.state_code,
    pincode: s.pincode,
    supportEmail: s.support_email,
    supportPhone: national(s.support_phone),
    grievanceOfficerName: s.grievance_officer_name,
    grievanceOfficerEmail: s.grievance_officer_email,
    grievanceOfficerPhone: national(s.grievance_officer_phone),
    invoicePrefix: s.invoice_prefix,
    creditNotePrefix: s.credit_note_prefix,
    taxSlabBasis: s.tax_slab_basis as SettingsInput["taxSlabBasis"],
    shippingTaxRate: s.shipping_tax_rate_bps === null ? "" : bpsToPercentInput(s.shipping_tax_rate_bps),
    lowStockThreshold: String(s.low_stock_threshold),
    newBadgeDays: String(s.new_badge_days),
  };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export type CouponState = "off" | "scheduled" | "ended" | "used_up" | "live";

export type AdminCoupon = {
  id: string;
  code: string;
  kind: "percent" | "flat";
  value: number; // percent, or paise for flat
  maxDiscountPaise: number | null;
  minCartPaise: number;
  maxUses: number | null;
  perUserLimit: number | null;
  firstOrderOnly: boolean;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  state: CouponState;
};

export async function listAdminCoupons(): Promise<AdminCoupon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const now = Date.now();
  return data.map((c) => {
    let state: CouponState = "live";
    if (!c.is_active) state = "off";
    else if (c.starts_at && new Date(c.starts_at).getTime() > now) state = "scheduled";
    else if (c.ends_at && new Date(c.ends_at).getTime() <= now) state = "ended";
    else if (c.max_uses !== null && c.used_count >= c.max_uses) state = "used_up";
    return {
      id: c.id,
      code: c.code,
      kind: c.kind as AdminCoupon["kind"],
      value: c.value,
      maxDiscountPaise: c.max_discount_paise,
      minCartPaise: c.min_cart_paise,
      maxUses: c.max_uses,
      perUserLimit: c.per_user_limit,
      firstOrderOnly: c.first_order_only,
      usedCount: c.used_count,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      isActive: c.is_active,
      state,
    };
  });
}

// ---------------------------------------------------------------------------
// Account deletion requests (dashboard)
// ---------------------------------------------------------------------------
export type DeletionRequest = { userId: string; requestedAt: string; orderCount: number };

export async function listDeletionRequests(): Promise<DeletionRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, deletion_requested_at")
    .not("deletion_requested_at", "is", null)
    .is("deletion_processed_at", null)
    .order("deletion_requested_at")
    .limit(50);
  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("user_id")
    .in(
      "user_id",
      data.map((p) => p.id),
    );
  if (ordersError) throw new Error(ordersError.message);
  return data.map((p) => ({
    userId: p.id,
    requestedAt: p.deletion_requested_at!,
    orderCount: orders.filter((o) => o.user_id === p.id).length,
  }));
}
