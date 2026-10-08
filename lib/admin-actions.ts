import type { z } from "zod";

// Shared result shape and error wording for admin Server Actions.

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again";
}

// Constraint names from the catalog migration → what the admin should fix.
const UNIQUE_MESSAGES: Record<string, string> = {
  products_slug_key: "Another product already uses this URL slug.",
  product_variants_sku_key: "One of these SKUs is already used by another product.",
  product_variants_product_id_size_colour_key: "This product already has that size and colour.",
  categories_slug_key: "Another category already uses this URL slug.",
  collections_slug_key: "Another collection already uses this URL slug.",
  tags_slug_key: "Another tag already uses this slug.",
  size_charts_name_key: "Another size chart already has this name.",
  coupons_code_key: "Another coupon already uses this code.",
};

type DbError = { code?: string; message: string };

export function dbErrorMessage(error: DbError, fallback = "Couldn't save. Please try again."): string {
  switch (error.code) {
    case "23505": {
      const constraint = Object.keys(UNIQUE_MESSAGES).find((name) => error.message.includes(name));
      return constraint ? UNIQUE_MESSAGES[constraint] : "That value is already in use.";
    }
    case "23503":
      return "This is still in use, so it can't be deleted. Archive or deactivate it instead.";
    case "23514":
      if (error.message.includes("stock:below_reserved")) {
        return "Stock can't go below the units reserved for pending orders.";
      }
      if (error.message.includes("own ancestor")) return "A category can't sit inside itself.";
      return "Some values aren't allowed. Check the form and try again.";
    case "42501":
      return "You don't have permission to do that.";
    default:
      return fallback;
  }
}
