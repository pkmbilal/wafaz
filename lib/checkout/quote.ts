import "server-only";
import { getPricingContext } from "@/lib/checkout/context";
import { buildCartSnapshot } from "@/lib/cart/snapshot";
import type { CartSnapshot } from "@/lib/cart/types";
import { istDate, SlabLookupError } from "@/lib/gst";
import { checkoutQuote, evaluateCoupon, type CheckoutQuote, type CouponRules } from "@/lib/pricing";
import { zoneForState } from "@/lib/shipping/zones";
import type { createClient } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof createClient>>;

export type QuoteSummary = Omit<CheckoutQuote, "lines"> & { couponCode: string | null };

export type QuoteResult =
  | { ok: true; cart: CartSnapshot; quote: QuoteSummary; couponError?: string }
  | { ok: false; error: string; cart?: CartSnapshot };

// The checkout preview, priced with lib/pricing.ts from the user's cart. create_order_from_cart()
// recomputes the same figures in the DB when the order is placed.
export async function quoteForUser(
  supabase: UserClient,
  input: { stateCode: string; couponCode?: string; email?: string; phone?: string },
): Promise<QuoteResult> {
  const { data: rows, error } = await supabase.rpc("cart_lines");
  if (error) return { ok: false, error: "Couldn't load your cart." };
  const cart = buildCartSnapshot(rows ?? []);
  if (cart.lines.length === 0) return { ok: false, error: "Your cart is empty.", cart };
  if (cart.hasIssues) return { ok: false, error: "Some items in your cart need attention.", cart };

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id, weight_grams, products!inner(hsn_code)")
    .in(
      "id",
      cart.lines.map((l) => l.variantId),
    );
  if (variantError || !variants || variants.length !== cart.lines.length) {
    return { ok: false, error: "Some items in your cart need attention.", cart };
  }
  const byId = new Map(variants.map((v) => [v.id, v]));

  const context = await getPricingContext();
  const zone = zoneForState(context.zones, input.stateCode);
  if (!zone) return { ok: false, error: "We don't deliver to this state yet.", cart };

  let discountPaise = 0;
  let couponCode: string | null = null;
  let couponError: string | undefined;
  if (input.couponCode) {
    const { data: coupon } = await supabase
      .rpc("coupon_for_checkout", {
        p_code: input.couponCode,
        p_email: input.email ?? "",
        p_phone: input.phone ?? "",
      })
      .maybeSingle();
    const rules: CouponRules | null = coupon
      ? {
          code: coupon.code,
          kind: coupon.kind === "flat" ? "flat" : "percent",
          value: coupon.value,
          maxDiscountPaise: coupon.max_discount_paise,
          minCartPaise: coupon.min_cart_paise,
          firstOrderOnly: coupon.first_order_only,
          isActive: coupon.is_active,
          startsAt: coupon.starts_at,
          endsAt: coupon.ends_at,
          exhausted: coupon.exhausted,
          customerUses: coupon.customer_uses,
          perUserLimit: coupon.per_user_limit,
          hasPaidOrder: coupon.has_paid_order,
        }
      : null;
    const result = evaluateCoupon(rules, cart.totals.subtotalPaise);
    if (result.ok) {
      discountPaise = result.discountPaise;
      couponCode = result.code;
    } else {
      couponError = result.message;
    }
  }

  try {
    const { lines, ...totals } = checkoutQuote({
      lines: cart.lines.map((l) => {
        const v = byId.get(l.variantId)!;
        return {
          variantId: l.variantId,
          hsnCode: v.products.hsn_code,
          pricePaise: l.pricePaise,
          qty: l.qty,
          weightGrams: v.weight_grams,
        };
      }),
      discountPaise,
      zone,
      slabs: context.slabs,
      slabBasis: context.slabBasis,
      shippingTaxRateBps: context.shippingTaxRateBps,
      stateCode: input.stateCode,
      sellerStateCode: context.sellerStateCode,
      onDate: istDate(),
    });
    void lines;
    return { ok: true, cart, quote: { ...totals, couponCode }, couponError };
  } catch (e) {
    if (e instanceof SlabLookupError) {
      console.error("[checkout] tax slab lookup failed");
      return { ok: false, error: "We couldn't price your order. Please contact us.", cart };
    }
    throw e;
  }
}
