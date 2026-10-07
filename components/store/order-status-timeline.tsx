import { Check } from "lucide-react";
import { cn } from "cn";
import type { TimelineStep } from "@/lib/orders/status";

export function OrderStatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol aria-label="Order progress" className="flex flex-col gap-0 sm:flex-row sm:gap-2">
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-start sm:gap-2"
        >
          <div className="flex flex-col items-center sm:w-full sm:flex-row">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" && "border-primary text-primary",
                step.state === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              {step.state === "done" ? <Check aria-hidden className="size-4" /> : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-5 w-px sm:h-px sm:w-full sm:flex-1",
                  step.state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
          <span
            className={cn(
              "pb-5 text-sm sm:pb-0",
              step.state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground",
            )}
          >
            {step.label}
            <span className="sr-only">
              {step.state === "done" ? " (done)" : step.state === "current" ? " (in progress)" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
