import { describe, expect, it } from "vitest";
import { cartTotals, lineTotalPaise } from "@/lib/pricing";

describe("lineTotalPaise", () => {
  it("multiplies price by quantity", () => {
    expect(lineTotalPaise({ pricePaise: 149_900, qty: 3 })).toBe(449_700);
  });
});

describe("cartTotals", () => {
  it("returns zeros for an empty cart", () => {
    expect(cartTotals([])).toEqual({ subtotalPaise: 0, mrpTotalPaise: 0, savingsPaise: 0, itemCount: 0 });
  });

  it("sums lines, MRP and savings", () => {
    expect(
      cartTotals([
        { pricePaise: 129_900, mrpPaise: 199_900, qty: 2 },
        { pricePaise: 89_950, mrpPaise: 89_950, qty: 1 },
      ]),
    ).toEqual({
      subtotalPaise: 349_750,
      mrpTotalPaise: 489_750,
      savingsPaise: 140_000,
      itemCount: 3,
    });
  });

  it("never reports negative savings", () => {
    expect(cartTotals([{ pricePaise: 1_000, mrpPaise: 900, qty: 1 }]).savingsPaise).toBe(0);
  });

  it("rejects non-integer money", () => {
    expect(() => cartTotals([{ pricePaise: 10.5, mrpPaise: 20, qty: 1 }])).toThrow();
  });
});
