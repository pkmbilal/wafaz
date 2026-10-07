import { Check } from "lucide-react";
import { cn } from "cn";

export const CHECKOUT_STEPS = ["Contact", "Address", "Review & pay"] as const;

// Step indicator. `current` is 0-based.
export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Checkout steps" className="flex items-center gap-2 text-sm">
      {CHECKOUT_STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary text-primary",
                state === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check aria-hidden className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(state === "upcoming" ? "text-muted-foreground" : "font-medium", "max-sm:sr-only")}>
              {label}
            </span>
            {i < CHECKOUT_STEPS.length - 1 && <span aria-hidden className="h-px w-6 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}
