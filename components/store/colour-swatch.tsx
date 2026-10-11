"use client";

import { cn } from "cn";
import type { ColourOption } from "@/lib/catalog/queries";

// Native radio inputs keep arrow-key navigation and form semantics; the swatch is the label.
export function ColourSwatch({
  colours,
  value,
  onChange,
  name = "colour",
}: {
  colours: ColourOption[];
  value: string;
  onChange: (colour: string) => void;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-3 eyebrow">
        <span className="text-foreground">Colour</span> <span className="ml-1 text-muted-foreground normal-case tracking-normal">{value}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {colours.map((c) => (
          <label key={c.name} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={c.name}
              checked={value === c.name}
              onChange={() => onChange(c.name)}
              className="peer sr-only"
            />
            <span
              title={c.name}
              className={cn(
                "flex size-touch items-center justify-center rounded-full border border-transparent transition-colors hover:border-border",
                "peer-checked:border-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60",
              )}
            >
              <span
                aria-hidden
                className="size-8 rounded-full ring-1 ring-border ring-inset"
                style={{ backgroundColor: c.hex ?? undefined }}
              />
            </span>
            <span className="sr-only">{c.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
