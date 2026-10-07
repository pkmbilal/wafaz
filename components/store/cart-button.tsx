"use client";

import { ShoppingBag } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/store/cart-provider";

export function CartCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-1 right-1 flex min-w-4.5 items-center justify-center rounded-full bg-festive px-1 text-[0.625rem] leading-4.5 font-semibold text-festive-foreground tabular-nums",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Header cart icon: opens the cart drawer and shows the item count.
export function CartButton() {
  const { cart, setOpen } = useCart();
  const count = cart?.totals.itemCount ?? 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <ShoppingBag />
      <CartCount count={count} />
    </Button>
  );
}
