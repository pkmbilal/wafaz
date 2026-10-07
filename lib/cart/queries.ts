import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildCartSnapshot } from "@/lib/cart/snapshot";
import { EMPTY_CART, type CartSnapshot } from "@/lib/cart/types";

// Cart reads run as the current user (guest or registered). Never cached; reads cookies.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getCart(client?: ServerClient): Promise<CartSnapshot> {
  const supabase = client ?? (await createClient());
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return EMPTY_CART;

  const { data, error } = await supabase.rpc("cart_lines");
  if (error) throw new Error(error.message);
  return buildCartSnapshot(data ?? []);
}
