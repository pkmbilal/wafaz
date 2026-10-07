// Cart and discount maths: the single source of truth (AGENTS.md §5.1). Integer paise only.
// M5 has cart totals only; coupon discount allocation and shipping arrive with checkout (M6).

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
