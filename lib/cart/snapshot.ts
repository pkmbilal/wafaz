import { cartTotals } from "@/lib/pricing";
import type { CartLine, CartLineIssue, CartSnapshot } from "@/lib/cart/types";

// Row shape returned by the cart_lines() DB function.
export type CartLineRow = {
  item_id: string;
  variant_id: string;
  qty: number;
  product_slug: string;
  title: string;
  size: string;
  colour: string;
  price_paise: number;
  mrp_paise: number;
  available: number;
  purchasable: boolean;
  image_key: string | null;
  image_alt: string | null;
};

export function lineIssue(row: Pick<CartLineRow, "purchasable" | "available" | "qty">): CartLineIssue {
  if (!row.purchasable || row.available <= 0) return "unavailable";
  if (row.qty > row.available) return "insufficient_stock";
  return null;
}

export function buildCartSnapshot(rows: readonly CartLineRow[]): CartSnapshot {
  const lines: CartLine[] = rows.map((r) => ({
    id: r.item_id,
    variantId: r.variant_id,
    productSlug: r.product_slug,
    title: r.title,
    size: r.size,
    colour: r.colour,
    pricePaise: r.price_paise,
    mrpPaise: r.mrp_paise,
    qty: r.qty,
    available: r.available,
    issue: lineIssue(r),
    imageKey: r.image_key,
    imageAlt: r.image_alt,
  }));

  return {
    lines,
    totals: cartTotals(lines.filter((l) => l.issue !== "unavailable")),
    hasIssues: lines.some((l) => l.issue !== null),
  };
}
