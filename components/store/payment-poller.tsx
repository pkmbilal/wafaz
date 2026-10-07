"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useOptionalCart } from "@/components/store/cart-provider";

const INTERVAL_MS = 3000;
const MAX_WAIT_MS = 120_000;

// "Confirming payment" state after Razorpay Checkout succeeds: refreshes the order page until the
// webhook marks it paid (AGENTS.md §5.4 step 3).
export function PaymentPoller() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const cart = useOptionalCart();
  const reloadCart = cart?.reload;

  // Unmounts once the order is confirmed: the paid lines have left the cart by then.
  useEffect(() => () => void reloadCart?.(), [reloadCart]);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > MAX_WAIT_MS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
      {!timedOut && <Loader2 aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />}
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">
          {timedOut ? "We're still confirming your payment." : "Confirming your payment…"}
        </p>
        <p className="text-muted-foreground">
          {timedOut
            ? "This can take a few minutes. If money left your account, your order is safe: refresh this page later, or contact us with your order number."
            : "This usually takes a few seconds. Please don't pay again."}
        </p>
      </div>
    </div>
  );
}
