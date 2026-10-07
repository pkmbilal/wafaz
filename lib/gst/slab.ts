// GST rate lookup by HSN code and per-piece value (DATA_MODEL §6, step 3). Never hardcode rates:
// slabs come from the tax_slabs table.

export type TaxSlab = {
  hsnCode: string;
  minUnitPaise: number;
  maxUnitPaise: number | null; // null = no upper bound
  rateBps: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
};

export type SlabBasis = "inclusive" | "taxable";

export class SlabLookupError extends Error {}

// Per-piece value = lineNet / qty, compared as an exact fraction (lineNet vs bound × qty).
// On the taxable basis the value is scaled by 10000 / (10000 + rate) using each slab's own rate.
// The range is min < value <= max; the lowest slab (min 0) also includes 0.
export function gstRateBps(
  slabs: readonly TaxSlab[],
  hsnCode: string,
  lineNetPaise: number,
  qty: number,
  onDate: string,
  basis: SlabBasis,
): number {
  if (!Number.isInteger(qty) || qty < 1) throw new Error("qty must be a positive integer");

  const matches = slabs.filter((s) => {
    if (s.hsnCode !== hsnCode) return false;
    if (s.effectiveFrom > onDate) return false;
    if (s.effectiveTo !== null && s.effectiveTo <= onDate) return false;
    const d = basis === "taxable" ? 10000 + s.rateBps : 10000;
    const scaledNet = lineNetPaise * 10000;
    const aboveMin = (s.minUnitPaise === 0 && lineNetPaise >= 0) || s.minUnitPaise * qty * d < scaledNet;
    const belowMax = s.maxUnitPaise === null || scaledNet <= s.maxUnitPaise * qty * d;
    return aboveMin && belowMax;
  });

  if (matches.length !== 1) {
    throw new SlabLookupError(`No single GST slab for HSN ${hsnCode} (${matches.length} matches)`);
  }
  return matches[0].rateBps;
}

// Today's date in IST as YYYY-MM-DD (business dates are never UTC).
export function istDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
}
