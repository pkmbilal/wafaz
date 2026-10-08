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

// Always two decimals, for tax documents ("₹1,250.00").
export function formatInrExact(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new Error(`formatInrExact expects integer paise, got ${paise}`);
  }
  return inrPaise.format(paise / 100);
}

// Whole-percent discount, rounded down so we never overstate a saving.
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", belowHundred(n % 100)].filter(Boolean).join(" ");
}

// Indian numbering (thousand, lakh, crore), as printed on tax invoices.
function integerInWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${integerInWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    belowThousand(rest),
  ]
    .filter(Boolean)
    .join(" ");
}

// "Rupees One Thousand Two Hundred and Fifty Paise Only".
export function amountInWords(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error(`amountInWords expects non-negative integer paise, got ${paise}`);
  }
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  const words = `Rupees ${integerInWords(rupees)}`;
  return rest ? `${words} and ${belowHundred(rest)} Paise Only` : `${words} Only`;
}
