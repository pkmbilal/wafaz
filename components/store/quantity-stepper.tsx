"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "cn";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  // Names the item for screen readers, e.g. "Anarkali Kurti, size M".
  label: string;
  className?: string;
};

export function QuantityStepper({ value, onChange, min = 1, max, disabled, label, className }: QuantityStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn("inline-flex items-center rounded-md border border-input bg-background", className)}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrease}
        onClick={() => onChange(value - 1)}
        className="flex size-touch items-center justify-center rounded-l-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-40"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="off" className="min-w-8 text-center text-sm font-medium tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrease}
        onClick={() => onChange(value + 1)}
        className="flex size-touch items-center justify-center rounded-r-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-40"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
