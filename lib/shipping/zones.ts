// Shipping charge by zone and parcel weight (ROADMAP Phase 1: Kerala / rest of India, priced per
// 500 g, free above a threshold). Mirrors private.shipping_quote() in SQL.

export type ShippingZone = {
  id: string;
  name: string;
  stateCodes: string[];
  basePaise: number;
  baseWeightGrams: number;
  perAdditional500gPaise: number;
  freeAbovePaise: number | null;
};

export const WEIGHT_STEP_GRAMS = 500;

export function zoneForState(zones: readonly ShippingZone[], stateCode: string): ShippingZone | null {
  return (
    [...zones]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .find((z) => z.stateCodes.includes(stateCode)) ?? null
  );
}

// The free-shipping threshold is tested on merchandise after any coupon discount.
// TODO(owner): confirm the threshold applies after discount rather than before.
export function shippingChargePaise(zone: ShippingZone, weightGrams: number, merchNetPaise: number): number {
  if (zone.freeAbovePaise !== null && merchNetPaise >= zone.freeAbovePaise) return 0;
  const extraSteps = Math.ceil(Math.max(0, weightGrams - zone.baseWeightGrams) / WEIGHT_STEP_GRAMS);
  return zone.basePaise + extraSteps * zone.perAdditional500gPaise;
}
