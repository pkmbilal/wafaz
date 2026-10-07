import { z } from "zod";

// Cart action inputs. A line holds at most 10 of one variant (cart_items check constraint).
export const MAX_LINE_QTY = 10;

export const addToCartSchema = z.object({
  variantId: z.uuid(),
  qty: z.int().min(1).max(MAX_LINE_QTY),
});

export const setCartQtySchema = z.object({
  itemId: z.uuid(),
  // 0 removes the line.
  qty: z.int().min(0).max(MAX_LINE_QTY),
});

export const cartItemIdSchema = z.uuid();
