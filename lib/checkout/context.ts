import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import type { SlabBasis, TaxSlab } from "@/lib/gst";
import type { ShippingZone } from "@/lib/shipping/zones";
import { createPublicClient } from "@/lib/supabase/public";

// Reference data for the checkout quote: tax slabs, shipping zones and the tax settings.
// Cached like other settings; the order itself is always priced from live data in the DB.

export type PricingContext = {
  slabs: TaxSlab[];
  zones: ShippingZone[];
  sellerStateCode: string;
  slabBasis: SlabBasis;
  shippingTaxRateBps: number | null;
};

export async function getPricingContext(): Promise<PricingContext> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.settings);

  const supabase = createPublicClient();
  const [slabs, zones, settings] = await Promise.all([
    supabase.from("tax_slabs").select("hsn_code, min_unit_paise, max_unit_paise, rate_bps, effective_from, effective_to"),
    supabase
      .from("shipping_zones")
      .select("id, name, state_codes, base_paise, base_weight_grams, per_additional_500g_paise, free_above_paise")
      .eq("is_active", true),
    supabase.rpc("checkout_tax_settings").single(),
  ]);
  if (slabs.error) throw new Error(slabs.error.message);
  if (zones.error) throw new Error(zones.error.message);
  if (settings.error) throw new Error(settings.error.message);

  return {
    slabs: slabs.data.map((s) => ({
      hsnCode: s.hsn_code,
      minUnitPaise: s.min_unit_paise,
      maxUnitPaise: s.max_unit_paise,
      rateBps: s.rate_bps,
      effectiveFrom: s.effective_from,
      effectiveTo: s.effective_to,
    })),
    zones: zones.data.map((z) => ({
      id: z.id,
      name: z.name,
      stateCodes: z.state_codes,
      basePaise: z.base_paise,
      baseWeightGrams: z.base_weight_grams,
      perAdditional500gPaise: z.per_additional_500g_paise,
      freeAbovePaise: z.free_above_paise,
    })),
    sellerStateCode: settings.data.state_code,
    slabBasis: settings.data.tax_slab_basis === "taxable" ? "taxable" : "inclusive",
    shippingTaxRateBps: settings.data.shipping_tax_rate_bps,
  };
}
