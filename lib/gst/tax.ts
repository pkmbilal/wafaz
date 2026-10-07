// GST maths (DATA_MODEL §6). Mirrors the SQL in the orders migration, which is authoritative for
// stored orders; this is used for the checkout preview. Integer paise only.

export type TaxSplit = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

function assertPaise(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be non-negative integer paise`);
}

// taxable = round(net × 10000 / (10000 + rate)), rounding half up, in exact integer arithmetic.
export function taxableFromInclusive(netPaise: number, rateBps: number): number {
  assertPaise(netPaise, "netPaise");
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error("rateBps must be 0–10000");
  const d = 10000 + rateBps;
  return Math.floor((2 * netPaise * 10000 + d) / (2 * d));
}

// Kerala (same state as the seller) → CGST + SGST split equally (odd paisa to SGST); else IGST.
export function splitTax(netPaise: number, rateBps: number, intraState: boolean): TaxSplit {
  const taxablePaise = taxableFromInclusive(netPaise, rateBps);
  const tax = netPaise - taxablePaise;
  if (!intraState) return { taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: tax };
  const cgstPaise = Math.floor(tax / 2);
  return { taxablePaise, cgstPaise, sgstPaise: tax - cgstPaise, igstPaise: 0 };
}

export function isIntraState(placeOfSupplyCode: string, sellerStateCode: string): boolean {
  return placeOfSupplyCode === sellerStateCode;
}
