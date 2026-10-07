import { describe, expect, it } from "vitest";
import type { TaxSlab } from "@/lib/gst";
import {
  allocateDiscount,
  checkoutQuote,
  couponDiscountPaise,
  couponMessage,
  couponRejectionFromDbError,
  evaluateCoupon,
  type CouponRules,
  type QuoteInput,
} from "@/lib/pricing";
import { shippingChargePaise, zoneForState, type ShippingZone } from "@/lib/shipping/zones";
import { dtdcTrackingUrl } from "@/lib/shipping/dtdc";
import { indiaPostTrackingUrl } from "@/lib/shipping/indiapost";

const KERALA: ShippingZone = {
  id: "z1",
  name: "Kerala",
  stateCodes: ["32"],
  basePaise: 5000,
  baseWeightGrams: 500,
  perAdditional500gPaise: 3000,
  freeAbovePaise: 149_900,
};
const REST: ShippingZone = { ...KERALA, id: "z2", name: "Rest of India", stateCodes: ["29", "27"], basePaise: 8000, perAdditional500gPaise: 4000 };

const SLABS: TaxSlab[] = [
  { hsnCode: "6204", minUnitPaise: 0, maxUnitPaise: 250_000, rateBps: 500, effectiveFrom: "2025-09-22", effectiveTo: null },
  { hsnCode: "6204", minUnitPaise: 250_000, maxUnitPaise: null, rateBps: 1800, effectiveFrom: "2025-09-22", effectiveTo: null },
];

describe("allocateDiscount", () => {
  it("splits in proportion and gives the remainder to the largest line", () => {
    // 1000 over 300/600/100: floor shares 300, 600, 100 → exact.
    expect(allocateDiscount([300, 600, 100], 1000)).toEqual([300, 600, 100]);
    // 2 over 1/1/1: floors 0/0/0, the remainder goes to the first line on a tie.
    expect(allocateDiscount([1, 1, 1], 2)).toEqual([2, 0, 0]);
    // 101 over 100/300/200: floors 16, 50, 33; the remainder 2 goes to the 300 line.
    expect(allocateDiscount([100, 300, 200], 101)).toEqual([16, 52, 33]);
  });

  it("always sums to the discount", () => {
    const shares = allocateDiscount([79_900, 179_800, 12_345], 25_971);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(25_971);
  });

  it("handles no discount, no lines and invalid amounts", () => {
    expect(allocateDiscount([100, 200], 0)).toEqual([0, 0]);
    expect(allocateDiscount([], 0)).toEqual([]);
    expect(allocateDiscount([0, 0], 0)).toEqual([0, 0]);
    expect(() => allocateDiscount([100], 101)).toThrow();
    expect(() => allocateDiscount([100], -1)).toThrow();
  });
});

const RULES: CouponRules = {
  code: "WELCOME10",
  kind: "percent",
  value: 10,
  maxDiscountPaise: 50_000,
  minCartPaise: 0,
  firstOrderOnly: true,
  isActive: true,
  startsAt: null,
  endsAt: null,
  exhausted: false,
  customerUses: 0,
  perUserLimit: 1,
  hasPaidOrder: false,
};

describe("evaluateCoupon", () => {
  const now = new Date("2026-10-08T10:00:00Z");

  it("accepts a valid coupon", () => {
    expect(evaluateCoupon(RULES, 259_700, now)).toEqual({ ok: true, code: "WELCOME10", discountPaise: 25_970 });
  });

  it.each([
    ["invalid", null],
    ["invalid", { ...RULES, isActive: false }],
    ["expired", { ...RULES, startsAt: "2026-11-01T00:00:00Z" }],
    ["expired", { ...RULES, endsAt: "2026-10-08T10:00:00Z" }],
    ["min_cart", { ...RULES, minCartPaise: 300_000 }],
    ["exhausted", { ...RULES, exhausted: true }],
    ["used", { ...RULES, customerUses: 1 }],
    ["first_order", { ...RULES, perUserLimit: null, hasPaidOrder: true }],
  ] as const)("rejects: %s", (reason, rules) => {
    const result = evaluateCoupon(rules, 259_700, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
      expect(result.message).toBe(couponMessage(reason, rules?.minCartPaise));
    }
  });

  it("allows a coupon inside its window", () => {
    const windowed = { ...RULES, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" };
    expect(evaluateCoupon(windowed, 100_000, now).ok).toBe(true);
  });

  it("computes and caps discounts", () => {
    expect(couponDiscountPaise({ kind: "percent", value: 10, maxDiscountPaise: null }, 99_999)).toBe(9_999);
    expect(couponDiscountPaise({ kind: "percent", value: 50, maxDiscountPaise: 50_000 }, 400_000)).toBe(50_000);
    expect(couponDiscountPaise({ kind: "flat", value: 20_000, maxDiscountPaise: null }, 15_000)).toBe(15_000);
  });

  it("words every rejection and maps DB errors", () => {
    expect(couponMessage("min_cart", 199_900)).toContain("1,999");
    expect(couponMessage("invalid")).toMatch(/isn't valid/);
    expect(couponMessage("expired")).toMatch(/expired/);
    expect(couponMessage("exhausted")).toMatch(/redeemed/);
    expect(couponMessage("used")).toMatch(/already used/);
    expect(couponMessage("first_order")).toMatch(/first order/);
    expect(couponRejectionFromDbError("coupon:first_order")).toBe("first_order");
    expect(couponRejectionFromDbError("checkout:empty")).toBeNull();
  });
});

describe("shipping", () => {
  it("finds the zone for a state", () => {
    expect(zoneForState([REST, KERALA], "32")?.id).toBe("z1");
    expect(zoneForState([REST, KERALA], "29")?.id).toBe("z2");
    expect(zoneForState([REST, KERALA], "99")).toBeNull();
  });

  it.each([
    [400, 50_000, 5000],
    [500, 50_000, 5000],
    [501, 50_000, 8000],
    [1500, 50_000, 11_000],
    [3000, 149_900, 0], // free at the threshold
  ])("%i g, merchandise %i → %i", (weight, merch, expected) => {
    expect(shippingChargePaise(KERALA, weight, merch)).toBe(expected);
  });

  it("charges every order when there is no free threshold", () => {
    expect(shippingChargePaise({ ...KERALA, freeAbovePaise: null }, 400, 10_000_000)).toBe(5000);
  });

  it("builds tracking links", () => {
    expect(dtdcTrackingUrl(" D123 ")).toContain("D123");
    expect(indiaPostTrackingUrl()).toMatch(/^https:\/\/www\.indiapost\.gov\.in/);
  });
});

describe("checkoutQuote", () => {
  const base: QuoteInput = {
    lines: [
      { variantId: "b", hsnCode: "6204", pricePaise: 89_900, qty: 2, weightGrams: 350 },
      { variantId: "a", hsnCode: "6204", pricePaise: 79_900, qty: 1, weightGrams: 300 },
    ],
    discountPaise: 25_970,
    zone: KERALA,
    slabs: SLABS,
    slabBasis: "inclusive",
    shippingTaxRateBps: null,
    stateCode: "32",
    sellerStateCode: "32",
    onDate: "2026-10-08",
  };

  it("matches the worked example (Kerala, coupon, free shipping)", () => {
    const q = checkoutQuote(base);
    expect(q.lines.map((l) => l.variantId)).toEqual(["a", "b"]);
    expect(q.lines.map((l) => l.discountPaise)).toEqual([7990, 17_980]);
    expect(q.subtotalPaise).toBe(259_700);
    expect(q.shippingPaise).toBe(0);
    expect(q.totalPaise).toBe(233_730);
    expect(q.cgstPaise).toBe(5565);
    expect(q.sgstPaise).toBe(5565);
    expect(q.igstPaise).toBe(0);
    expect(q.taxableTotalPaise).toBe(222_600);
    expect(q.gstPaise + q.taxableTotalPaise).toBe(q.totalPaise);
    expect(q.totalWeightGrams).toBe(1000);
  });

  it("uses IGST and charges shipping outside Kerala, taxing shipping at the highest item rate", () => {
    const q = checkoutQuote({ ...base, discountPaise: 0, zone: REST, stateCode: "29", lines: [base.lines[1]] });
    expect(q.shippingPaise).toBe(8000);
    expect(q.shippingGstRateBps).toBe(500);
    expect(q.cgstPaise + q.sgstPaise).toBe(0);
    expect(q.igstPaise).toBe(q.gstPaise);
    expect(q.totalPaise).toBe(87_900);
  });

  it("uses the configured shipping rate when set", () => {
    const q = checkoutQuote({ ...base, discountPaise: 0, zone: REST, stateCode: "29", shippingTaxRateBps: 1800, lines: [base.lines[1]] });
    expect(q.shippingGstRateBps).toBe(1800);
    expect(q.shippingTaxablePaise).toBe(6780);
  });
});

describe("orderStatusSummary", () => {
  it("marks finished steps done and the next one current", async () => {
    const { orderStatusSummary } = await import("@/lib/orders/status");
    const confirmed = orderStatusSummary({ orderStatus: "confirmed", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" });
    expect(confirmed.headline).toBe("Order confirmed");
    expect(confirmed.steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);

    const delivered = orderStatusSummary({ orderStatus: "completed", paymentStatus: "paid", fulfillmentStatus: "delivered" });
    expect(delivered.steps.every((s) => s.state === "done")).toBe(true);

    expect(orderStatusSummary({ orderStatus: "pending_payment", paymentStatus: "failed", fulfillmentStatus: "unfulfilled" }).headline).toBe("Payment failed");
    expect(orderStatusSummary({ orderStatus: "expired", paymentStatus: "refunded", fulfillmentStatus: "unfulfilled" }).headline).toBe("Refunded");
  });
});
