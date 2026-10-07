// Display helpers only. All money maths stays in integer paise (AGENTS.md §5.1).

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInr(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new Error(`formatInr expects integer paise, got ${paise}`);
  }
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inrPaise.format(paise / 100);
}

// Whole-percent discount, rounded down so we never overstate a saving.
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise);
}
