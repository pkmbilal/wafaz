"use server";

import { refresh } from "next/cache";
import { type ActionResult, dbErrorMessage, firstIssue } from "@/lib/admin-actions";
import { requireOwner } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { couponSchema } from "@/lib/validators/admin-coupons";

// Coupons (owner only; staff can see them). Coupons are never deleted because redemptions refer
// to them; switch one off instead. Checkout re-validates every rule (lib/pricing.ts).
export async function saveCoupon(input: unknown): Promise<ActionResult> {
  if (!(await requireOwner())) return { ok: false, error: "Only the owner can change coupons." };
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...c } = parsed.data;

  const row = {
    code: c.code,
    kind: c.kind,
    value: c.value,
    max_discount_paise: c.maxDiscount,
    min_cart_paise: c.minCart ?? 0,
    max_uses: c.maxUses,
    per_user_limit: c.perUserLimit,
    first_order_only: c.firstOrderOnly,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    is_active: c.isActive,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("coupons").update(row).eq("id", id)
    : await supabase.from("coupons").insert(row);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: id ? "Coupon saved" : "Coupon created" };
}
