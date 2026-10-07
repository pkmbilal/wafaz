import type { CartTotals } from "@/lib/pricing";

// Cart snapshot shared by the server (queries, actions) and the client (provider, drawer, page).

export type CartLineIssue = "unavailable" | "insufficient_stock" | null;

export type CartLine = {
  id: string;
  variantId: string;
  productSlug: string;
  title: string;
  size: string;
  colour: string;
  pricePaise: number;
  mrpPaise: number;
  qty: number;
  available: number;
  issue: CartLineIssue;
  imageKey: string | null;
  imageAlt: string | null;
};

export type CartSnapshot = {
  lines: CartLine[];
  // Totals of the lines that can be bought now (no "unavailable" lines).
  totals: CartTotals;
  // True when any line needs attention before checkout.
  hasIssues: boolean;
};

export const EMPTY_CART: CartSnapshot = {
  lines: [],
  totals: { subtotalPaise: 0, mrpTotalPaise: 0, savingsPaise: 0, itemCount: 0 },
  hasIssues: false,
};
