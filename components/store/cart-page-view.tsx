"use client";

import { useEffect } from "react";
import { ShoppingBag } from "lucide-react";
import { CartLineItem } from "@/components/store/cart-line-item";
import { useCart } from "@/components/store/cart-provider";
import { CartSummary } from "@/components/store/cart-summary";
import { EmptyState } from "@/components/store/empty-state";
import type { CartSnapshot } from "@/lib/cart/types";

// Full cart page. Starts from the server-rendered snapshot, then follows the shared cart state
// so changes made here and in the drawer stay in sync.
export function CartPageView({ initial }: { initial: CartSnapshot }) {
  const { cart: live, seed, setQty, remove } = useCart();
  const cart = live ?? initial;

  useEffect(() => {
    seed(initial);
    // Seed once with the server snapshot; later updates come from cart actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Find something you love in our latest collection."
        action={{ label: "Shop new arrivals", href: "/collections/new-arrivals" }}
      />
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {cart.lines.map((line) => (
          <li key={line.id} className="py-5">
            <CartLineItem
              line={line}
              size="lg"
              onQtyChange={(qty) => setQty(line.id, qty)}
              onRemove={() => remove(line.id)}
            />
          </li>
        ))}
      </ul>
      <section
        aria-label="Order summary"
        className="rounded-lg border border-border bg-card p-5 shadow-soft lg:sticky lg:top-24"
      >
        <h2 className="mb-4 text-2xl font-semibold">Summary</h2>
        <CartSummary cart={cart} />
      </section>
    </div>
  );
}
