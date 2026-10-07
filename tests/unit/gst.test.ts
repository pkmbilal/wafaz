import { describe, expect, it } from "vitest";
import { gstRateBps, istDate, isIntraState, SlabLookupError, splitTax, taxableFromInclusive, type TaxSlab } from "@/lib/gst";

const SLABS: TaxSlab[] = [
  { hsnCode: "6204", minUnitPaise: 0, maxUnitPaise: 250_000, rateBps: 500, effectiveFrom: "2025-09-22", effectiveTo: null },
  { hsnCode: "6204", minUnitPaise: 250_000, maxUnitPaise: null, rateBps: 1800, effectiveFrom: "2025-09-22", effectiveTo: null },
  // An older rate that has ended.
  { hsnCode: "6204", minUnitPaise: 0, maxUnitPaise: null, rateBps: 1200, effectiveFrom: "2020-01-01", effectiveTo: "2025-09-22" },
];
const ON = "2026-10-08";

describe("taxableFromInclusive", () => {
  it.each([
    [105_000, 500, 100_000],
    [71_910, 500, 68_486], // 68485.71 rounds up
    [118_000, 1800, 100_000],
    [0, 500, 0],
    [100, 0, 100],
  ])("net %i at %i bps → %i", (net, rate, expected) => {
    expect(taxableFromInclusive(net, rate)).toBe(expected);
  });

  it("rounds exact halves up", () => {
    // 21 × 10000 / 10500 = 20 exactly; 1050 bps cases give .5 at 2.1 paise × ...
    expect(taxableFromInclusive(21, 500)).toBe(20);
    // 10.5 → 11: net 11.025 is not integer, so use rate 10000 (÷2): 21 / 2 = 10.5
    expect(taxableFromInclusive(21, 10000)).toBe(11);
  });

  it("rejects bad input", () => {
    expect(() => taxableFromInclusive(-1, 500)).toThrow();
    expect(() => taxableFromInclusive(1.5, 500)).toThrow();
    expect(() => taxableFromInclusive(100, 10001)).toThrow();
    expect(() => taxableFromInclusive(100, -1)).toThrow();
  });
});

describe("splitTax", () => {
  it("splits equally within Kerala, odd paisa to SGST", () => {
    expect(splitTax(71_910, 500, true)).toEqual({ taxablePaise: 68_486, cgstPaise: 1712, sgstPaise: 1712, igstPaise: 0 });
    // tax 3 → 1 + 2
    expect(splitTax(63, 500, true)).toEqual({ taxablePaise: 60, cgstPaise: 1, sgstPaise: 2, igstPaise: 0 });
  });

  it("uses IGST for other states", () => {
    expect(splitTax(71_910, 500, false)).toEqual({ taxablePaise: 68_486, cgstPaise: 0, sgstPaise: 0, igstPaise: 3424 });
  });

  it("knows the place of supply rule", () => {
    expect(isIntraState("32", "32")).toBe(true);
    expect(isIntraState("29", "32")).toBe(false);
  });
});

describe("gstRateBps (inclusive basis)", () => {
  it.each([
    [0, 1, 500], // the lowest slab includes 0
    [100, 1, 500],
    [250_000, 1, 500], // "not exceeding" ₹2,500
    [250_001, 1, 1800],
    [500_000, 2, 500], // ₹2,500 per piece
    [500_001, 2, 1800], // just over ₹2,500 per piece, compared exactly
  ])("line %i × qty %i → %i bps", (net, qty, expected) => {
    expect(gstRateBps(SLABS, "6204", net, qty, ON, "inclusive")).toBe(expected);
  });

  it("uses the slab in force on the date", () => {
    expect(gstRateBps(SLABS, "6204", 300_000, 1, "2025-01-01", "inclusive")).toBe(1200);
  });

  it("throws when no slab matches", () => {
    expect(() => gstRateBps(SLABS, "9999", 100, 1, ON, "inclusive")).toThrow(SlabLookupError);
  });

  it("throws when slabs overlap", () => {
    const overlapping = [...SLABS, { ...SLABS[0], rateBps: 1200 }];
    expect(() => gstRateBps(overlapping, "6204", 100, 1, ON, "inclusive")).toThrow(SlabLookupError);
  });

  it("rejects a bad quantity", () => {
    expect(() => gstRateBps(SLABS, "6204", 100, 0, ON, "inclusive")).toThrow();
  });
});

describe("gstRateBps (taxable basis)", () => {
  it("tests the slab against the taxable value", () => {
    // ₹2,625 inclusive at 5% is ₹2,500 taxable → still the 5% slab.
    expect(gstRateBps(SLABS, "6204", 262_500, 1, ON, "taxable")).toBe(500);
    // ₹3,000 at 18% is ₹2,542 taxable → 18%.
    expect(gstRateBps(SLABS, "6204", 300_000, 1, ON, "taxable")).toBe(1800);
  });

  it("throws in the gap where neither slab's own test passes", () => {
    // ₹2,700: 5% gives ₹2,571 (> ₹2,500), 18% gives ₹2,288 (≤ ₹2,500). The CA must resolve this.
    expect(() => gstRateBps(SLABS, "6204", 270_000, 1, ON, "taxable")).toThrow(SlabLookupError);
  });
});

describe("istDate", () => {
  it("uses Asia/Kolkata", () => {
    // 20:00 UTC on 31 March is 01:30 IST on 1 April.
    expect(istDate(new Date("2026-03-31T20:00:00Z"))).toBe("2026-04-01");
  });
});
