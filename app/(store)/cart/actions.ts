"use server";

import { getCart } from "@/lib/cart/queries";
import type { CartSnapshot } from "@/lib/cart/types";
import { createClient } from "@/lib/supabase/server";
import { addToCartSchema, cartItemIdSchema, MAX_LINE_QTY, setCartQtySchema } from "@/lib/validators/cart";

// Cart mutations run as the current user (anonymous guests included), so RLS limits them to the
// caller's own cart. They never create a session: the client signs in lazily first (lib/auth/guest.ts).
// Each action returns the fresh cart so the UI updates in one round trip.

export type CartActionResult =
  | { ok: true; cart: CartSnapshot; notice?: string }
  | { ok: false; error: string; cart?: CartSnapshot; code?: "stale_session" };

const GENERIC_ERROR = "Couldn't update your cart. Please try again.";

async function sessionClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ? supabase : null;
}

export async function getCartSnapshot(): Promise<CartSnapshot> {
  return getCart();
}

export async function addToCart(input: unknown): Promise<CartActionResult> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await sessionClient();
  if (!supabase) return { ok: false, error: "Your session has expired. Please try again." };

  const { data, error } = await supabase
    .rpc("cart_add_item", { p_variant_id: parsed.data.variantId, p_qty: parsed.data.qty })
    .single();
  if (error) {
    // The session's user no longer exists (e.g. a guest removed by the 30-day cleanup).
    if (error.code === "23503") return { ok: false, error: GENERIC_ERROR, code: "stale_session" };
    const unavailable = error.code === "P0002";
    return {
      ok: false,
      error: unavailable ? "Sorry, this item is no longer available." : GENERIC_ERROR,
    };
  }

  const cart = await getCart(supabase);
  if (data.qty === 0) {
    return { ok: false, error: "Sorry, this size just sold out.", cart };
  }
  if (data.qty < data.requested) {
    const reason =
      data.qty >= MAX_LINE_QTY
        ? `You can add up to ${MAX_LINE_QTY} of each item.`
        : `Only ${data.available} left. Your cart has ${data.qty}.`;
    return { ok: false, error: reason, cart };
  }
  return { ok: true, cart };
}

export async function updateCartQty(input: unknown): Promise<CartActionResult> {
  const parsed = setCartQtySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await sessionClient();
  if (!supabase) return { ok: false, error: "Your session has expired. Please try again." };

  const { data, error } = await supabase.rpc("cart_set_qty", {
    p_item_id: parsed.data.itemId,
    p_qty: parsed.data.qty,
  });
  const cart = await getCart(supabase);
  if (error) return { ok: false, error: GENERIC_ERROR, cart };
  if (parsed.data.qty > 0 && data < parsed.data.qty) {
    return { ok: true, cart, notice: `Only ${data} available.` };
  }
  return { ok: true, cart };
}

export async function removeCartItem(input: unknown): Promise<CartActionResult> {
  const parsed = cartItemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await sessionClient();
  if (!supabase) return { ok: false, error: "Your session has expired. Please try again." };

  const { error } = await supabase.from("cart_items").delete().eq("id", parsed.data);
  const cart = await getCart(supabase);
  if (error) return { ok: false, error: GENERIC_ERROR, cart };
  return { ok: true, cart };
}
