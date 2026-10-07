import { gstRateBps, isIntraState, splitTax, type SlabBasis, type TaxSlab } from "@/lib/gst";
import { shippingChargePaise, type ShippingZone } from "@/lib/shipping/zones";

// Cart and discount maths: the single source of truth (AGENTS.md §5.1). Integer paise only.
// The checkout quote mirrors create_order_from_cart() in SQL, which is authoritative for the
// stored order; tests check that both agree.

export type PricedLine = {
  pricePaise: number;
  mrpPaise: number;
  qty: number;
};

export type CartTotals = {
  // Selling price × qty, GST-inclusive.
  subtotalPaise: number;
  mrpTotalPaise: number;
  // MRP minus selling price, shown as "You save".
  savingsPaise: number;
  itemCount: number;
};

export function lineTotalPaise(line: Pick<PricedLine, "pricePaise" | "qty">): number {
  return line.pricePaise * line.qty;
}

export function cartTotals(lines: readonly PricedLine[]): CartTotals {
  let subtotalPaise = 0;
  let mrpTotalPaise = 0;
  let itemCount = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.pricePaise) || !Number.isInteger(line.mrpPaise) || !Number.isInteger(line.qty)) {
      throw new Error("cartTotals expects integer paise and quantities");
    }
    subtotalPaise += lineTotalPaise(line);
    // A price above MRP is blocked by the DB; never report negative savings anyway.
    mrpTotalPaise += Math.max(line.mrpPaise, line.pricePaise) * line.qty;
    itemCount += line.qty;
  }
  return { subtotalPaise, mrpTotalPaise, savingsPaise: mrpTotalPaise - subtotalPaise, itemCount };
}

// ---------------------------------------------------------------------------
// Coupons (AGENTS.md §5.7). The DB re-checks everything when the order is created and again,
// under a lock, when the payment is committed.
// ---------------------------------------------------------------------------
export type CouponRules = {
  code: string;
  kind: "percent" | "flat";
  // percent: whole percent; flat: paise
  value: number;
  maxDiscountPaise: number | null;
  minCartPaise: number;
  firstOrderOnly: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  exhausted: boolean;
  customerUses: number;
  perUserLimit: number | null;
  hasPaidOrder: boolean;
};

export type CouponRejection = "invalid" | "expired" | "min_cart" | "exhausted" | "used" | "first_order";

export type CouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; reason: CouponRejection; message: string };

export function couponMessage(reason: CouponRejection, minCartPaise = 0): string {
  switch (reason) {
    case "invalid":
      return "This coupon code isn't valid.";
    case "expired":
      return "This coupon has expired or isn't active yet.";
    case "min_cart": {
      const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
      return `Add items worth ${inr.format(Math.ceil(minCartPaise / 100))} or more to use this coupon.`;
    }
    case "exhausted":
      return "This coupon has been fully redeemed.";
    case "used":
      return "You've already used this coupon.";
    case "first_order":
      return "This coupon is for your first order only.";
  }
}

// Same order of checks as private.coupon_discount() in SQL.
export function evaluateCoupon(rules: CouponRules | null, merchPaise: number, now: Date = new Date()): CouponResult {
  const reject = (reason: CouponRejection): CouponResult => ({
    ok: false,
    reason,
    message: couponMessage(reason, rules?.minCartPaise),
  });
  if (!rules || !rules.isActive) return reject("invalid");
  if ((rules.startsAt && now < new Date(rules.startsAt)) || (rules.endsAt && now >= new Date(rules.endsAt))) {
    return reject("expired");
  }
  if (merchPaise < rules.minCartPaise) return reject("min_cart");
  if (rules.exhausted) return reject("exhausted");
  if (rules.perUserLimit !== null && rules.customerUses >= rules.perUserLimit) return reject("used");
  if (rules.firstOrderOnly && rules.hasPaidOrder) return reject("first_order");
  return { ok: true, code: rules.code, discountPaise: couponDiscountPaise(rules, merchPaise) };
}

// Rounds down so we never overstate a discount; a flat coupon is clamped to the subtotal.
export function couponDiscountPaise(
  rules: Pick<CouponRules, "kind" | "value" | "maxDiscountPaise">,
  merchPaise: number,
): number {
  let discount = rules.kind === "percent" ? Math.floor((merchPaise * rules.value) / 100) : rules.value;
  if (rules.maxDiscountPaise !== null) discount = Math.min(discount, rules.maxDiscountPaise);
  return Math.min(discount, merchPaise);
}

// Maps the 'coupon:<reason>' errors raised by the DB to the same reasons.
export function couponRejectionFromDbError(message: string): CouponRejection | null {
  const match = /^coupon:(invalid|expired|min_cart|exhausted|used|first_order)$/.exec(message);
  return match ? (match[1] as CouponRejection) : null;
}

// ---------------------------------------------------------------------------
// Discount allocation (DATA_MODEL §6 step 1): in proportion to line value, rounding down, with
// the remainder on the largest line (the first one on a tie). Lines must be in variant_id order.
// ---------------------------------------------------------------------------
export function allocateDiscount(grossPaise: readonly number[], discountPaise: number): number[] {
  const total = grossPaise.reduce((sum, g) => sum + g, 0);
  if (discountPaise < 0 || discountPaise > total) throw new Error("discount must be between 0 and the subtotal");
  if (grossPaise.length === 0) return [];
  const shares = grossPaise.map((g) => (total === 0 ? 0 : Math.floor((discountPaise * g) / total)));
  let largest = 0;
  grossPaise.forEach((g, i) => {
    if (g > grossPaise[largest]) largest = i;
  });
  shares[largest] += discountPaise - shares.reduce((sum, s) => sum + s, 0);
  return shares;
}

// ---------------------------------------------------------------------------
// Checkout quote: what the order will cost, with the GST included in it.
// ---------------------------------------------------------------------------
export type QuoteLine = {
  variantId: string;
  hsnCode: string;
  pricePaise: number;
  qty: number;
  weightGrams: number;
};

export type QuotedLine = QuoteLine & {
  grossPaise: number;
  discountPaise: number;
  netPaise: number;
  gstRateBps: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

export type CheckoutQuote = {
  lines: QuotedLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingGstRateBps: number;
  shippingTaxablePaise: number;
  taxableTotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  // Total GST included in the price, shown as "Includes ₹X GST".
  gstPaise: number;
  totalWeightGrams: number;
};

export type QuoteInput = {
  lines: readonly QuoteLine[];
  discountPaise: number;
  zone: ShippingZone;
  slabs: readonly TaxSlab[];
  slabBasis: SlabBasis;
  // null until the CA sets it: shipping then takes the highest rate in the order.
  shippingTaxRateBps: number | null;
  stateCode: string;
  sellerStateCode: string;
  onDate: string; // YYYY-MM-DD in IST
};

export function checkoutQuote(input: QuoteInput): CheckoutQuote {
  const sorted = [...input.lines].sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
  const gross = sorted.map(lineTotalPaise);
  const subtotalPaise = gross.reduce((sum, g) => sum + g, 0);
  const discounts = allocateDiscount(gross, input.discountPaise);
  const intra = isIntraState(input.stateCode, input.sellerStateCode);

  const lines: QuotedLine[] = sorted.map((line, i) => {
    const netPaise = gross[i] - discounts[i];
    const rate = gstRateBps(input.slabs, line.hsnCode, netPaise, line.qty, input.onDate, input.slabBasis);
    return {
      ...line,
      grossPaise: gross[i],
      discountPaise: discounts[i],
      netPaise,
      gstRateBps: rate,
      ...splitTax(netPaise, rate, intra),
    };
  });

  const totalWeightGrams = sorted.reduce((sum, l) => sum + l.weightGrams * l.qty, 0);
  const shippingPaise = shippingChargePaise(input.zone, totalWeightGrams, subtotalPaise - input.discountPaise);
  // TODO(owner): CA to confirm shipping_tax_rate_bps (see the orders migration).
  const shippingGstRateBps = input.shippingTaxRateBps ?? Math.max(0, ...lines.map((l) => l.gstRateBps));
  const shippingTax = splitTax(shippingPaise, shippingGstRateBps, intra);

  const sum = (pick: (l: QuotedLine) => number) => lines.reduce((total, l) => total + pick(l), 0);
  const cgstPaise = sum((l) => l.cgstPaise) + shippingTax.cgstPaise;
  const sgstPaise = sum((l) => l.sgstPaise) + shippingTax.sgstPaise;
  const igstPaise = sum((l) => l.igstPaise) + shippingTax.igstPaise;

  return {
    lines,
    subtotalPaise,
    discountPaise: input.discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - input.discountPaise + shippingPaise,
    shippingGstRateBps,
    shippingTaxablePaise: shippingTax.taxablePaise,
    taxableTotalPaise: sum((l) => l.taxablePaise) + shippingTax.taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    gstPaise: cgstPaise + sgstPaise + igstPaise,
    totalWeightGrams,
  };
}
