"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CartLineItem } from "@/components/store/cart-line-item";
import { useCart } from "@/components/store/cart-provider";
import { CartSummary } from "@/components/store/cart-summary";

export function CartDrawer() {
  const { cart, isOpen, setOpen, setQty, remove } = useCart();
  const close = () => setOpen(false);
  const count = cart?.totals.itemCount ?? 0;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="text-2xl">Your cart</SheetTitle>
          <SheetDescription>
            {count === 1 ? "1 item" : `${count} items`}
          </SheetDescription>
        </SheetHeader>

        {cart === null ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag aria-hidden className="size-10 text-accent" strokeWidth={1.5} />
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="max-w-xs text-sm text-muted-foreground">Find something you love in our latest collection.</p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/collections/new-arrivals" onClick={close}>
                Shop new arrivals
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex flex-1 flex-col divide-y divide-border overflow-y-auto px-4">
              {cart.lines.map((line) => (
                <li key={line.id} className="py-4">
                  <CartLineItem
                    line={line}
                    onQtyChange={(qty) => setQty(line.id, qty)}
                    onRemove={() => remove(line.id)}
                    onNavigate={close}
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CartSummary cart={cart} />
              <Button asChild variant="outline" className="w-full">
                <Link href="/cart" onClick={close}>
                  View cart
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
