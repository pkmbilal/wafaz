"use client";

import { use } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

export type SizeOption = { size: string; variantId: string };

// Shown as "Only N left" at or below this count.
const LOW_STOCK = 3;

export function SizeSelector({
  options,
  availability,
  value,
  onChange,
  name = "size",
}: {
  options: SizeOption[];
  availability: Promise<Record<string, number>>;
  value: string | null;
  onChange: (variantId: string) => void;
  name?: string;
}) {
  const available = use(availability);
  const selected = options.find((o) => o.variantId === value);
  const selectedLeft = selected ? (available[selected.variantId] ?? 0) : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">Size</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const left = available[o.variantId] ?? 0;
          const soldOut = left <= 0;
          return (
            <label key={o.variantId} className={cn("relative", soldOut ? "cursor-not-allowed" : "cursor-pointer")}>
              <input
                type="radio"
                name={name}
                value={o.variantId}
                checked={value === o.variantId}
                disabled={soldOut}
                onChange={() => onChange(o.variantId)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-touch min-w-touch items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
                  "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60",
                  "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                  soldOut
                    ? "border-border bg-muted text-muted-foreground line-through"
                    : "border-input bg-background hover:border-primary",
                )}
              >
                {o.size}
              </span>
              {soldOut && <span className="sr-only"> (sold out)</span>}
            </label>
          );
        })}
      </div>
      <p className="min-h-5 text-sm text-sale" aria-live="polite">
        {selectedLeft !== null && selectedLeft > 0 && selectedLeft <= LOW_STOCK ? `Only ${selectedLeft} left` : ""}
      </p>
    </fieldset>
  );
}

export function SizeSelectorSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="mb-2 h-5 w-12" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="size-touch" />
        ))}
      </div>
    </div>
  );
}
