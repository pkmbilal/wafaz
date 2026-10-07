import { describe, expect, it } from "vitest";
import { buildCartSnapshot, lineIssue, type CartLineRow } from "@/lib/cart/snapshot";
import { addToCartSchema, setCartQtySchema } from "@/lib/validators/cart";

const ID = "4f8b3c1e-2a7d-4e9b-8c6f-1d2e3f4a5b6c";

function row(overrides: Partial<CartLineRow> = {}): CartLineRow {
  return {
    item_id: ID,
    variant_id: ID,
    qty: 1,
    product_slug: "anarkali-kurti",
    title: "Anarkali Kurti",
    size: "M",
    colour: "Indigo",
    price_paise: 149_900,
    mrp_paise: 199_900,
    available: 5,
    purchasable: true,
    image_key: null,
    image_alt: null,
    ...overrides,
  };
}

describe("lineIssue", () => {
  it.each([
    [{ purchasable: true, available: 5, qty: 2 }, null],
    [{ purchasable: true, available: 2, qty: 2 }, null],
    [{ purchasable: true, available: 1, qty: 2 }, "insufficient_stock"],
    [{ purchasable: true, available: 0, qty: 1 }, "unavailable"],
    [{ purchasable: false, available: 5, qty: 1 }, "unavailable"],
  ] as const)("%o → %s", (input, expected) => {
    expect(lineIssue(input)).toBe(expected);
  });
});

describe("buildCartSnapshot", () => {
  it("leaves unavailable lines out of the totals and flags issues", () => {
    const snapshot = buildCartSnapshot([
      row({ qty: 2 }),
      row({ item_id: "other", purchasable: false, qty: 1 }),
    ]);
    expect(snapshot.lines.map((l) => l.issue)).toEqual([null, "unavailable"]);
    expect(snapshot.totals.subtotalPaise).toBe(299_800);
    expect(snapshot.totals.itemCount).toBe(2);
    expect(snapshot.hasIssues).toBe(true);
  });

  it("has no issues for a clean cart", () => {
    expect(buildCartSnapshot([row()]).hasIssues).toBe(false);
  });
});

describe("cart validators", () => {
  it("accepts 1–10 when adding", () => {
    expect(addToCartSchema.safeParse({ variantId: ID, qty: 1 }).success).toBe(true);
    expect(addToCartSchema.safeParse({ variantId: ID, qty: 10 }).success).toBe(true);
    expect(addToCartSchema.safeParse({ variantId: ID, qty: 0 }).success).toBe(false);
    expect(addToCartSchema.safeParse({ variantId: ID, qty: 11 }).success).toBe(false);
    expect(addToCartSchema.safeParse({ variantId: ID, qty: 1.5 }).success).toBe(false);
    expect(addToCartSchema.safeParse({ variantId: "nope", qty: 1 }).success).toBe(false);
  });

  it("allows 0 (remove) when setting a quantity", () => {
    expect(setCartQtySchema.safeParse({ itemId: ID, qty: 0 }).success).toBe(true);
    expect(setCartQtySchema.safeParse({ itemId: ID, qty: -1 }).success).toBe(false);
  });
});
