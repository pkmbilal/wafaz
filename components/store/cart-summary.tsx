import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import type { CartSnapshot } from "@/lib/cart/types";

// Totals and the checkout call to action, shared by the cart drawer and the cart page.
export function CartSummary({ cart }: { cart: CartSnapshot }) {
  const { totals } = cart;

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5 text-sm">
        {totals.savingsPaise > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <dt>MRP total</dt>
              <dd className="tabular-nums line-through">{formatInr(totals.mrpTotalPaise)}</dd>
            </div>
            <div className="flex justify-between font-medium text-sale">
              <dt>You save</dt>
              <dd className="tabular-nums">{formatInr(totals.savingsPaise)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between text-base font-semibold">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatInr(totals.subtotalPaise)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Inclusive of all taxes. Shipping and coupons are applied at checkout.
      </p>
      {cart.hasIssues && (
        <p className="text-xs font-medium text-destructive">Update the highlighted items to continue.</p>
      )}
      {/* TODO(M6): link to /checkout once checkout exists. */}
      <Button size="lg" disabled className="w-full">
        Checkout
      </Button>
      <p className="text-center text-xs text-muted-foreground">Online ordering opens soon.</p>
    </div>
  );
}
