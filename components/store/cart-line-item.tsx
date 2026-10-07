"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { cn } from "cn";
import { PriceTag } from "@/components/store/price-tag";
import { QuantityStepper } from "@/components/store/quantity-stepper";
import { formatInr } from "@/lib/format";
import { lineTotalPaise } from "@/lib/pricing";
import { mediaUrl } from "@/lib/r2";
import type { CartLine } from "@/lib/cart/types";
import { MAX_LINE_QTY } from "@/lib/validators/cart";

type CartLineItemProps = {
  line: CartLine;
  onQtyChange: (qty: number) => Promise<void>;
  onRemove: () => Promise<void>;
  // Close the drawer when following the product link.
  onNavigate?: () => void;
  size?: "sm" | "lg";
};

export function CartLineItem({ line, onQtyChange, onRemove, onNavigate, size = "sm" }: CartLineItemProps) {
  const [pending, startTransition] = useTransition();
  const label = `${line.title}, ${line.colour}, size ${line.size}`;
  const unavailable = line.issue === "unavailable";

  return (
    <article
      aria-busy={pending}
      className={cn("flex gap-3 transition-opacity", pending && "opacity-60", size === "lg" && "gap-4")}
    >
      <Link
        href={`/products/${line.productSlug}`}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "relative aspect-4/5 shrink-0 overflow-hidden rounded-md bg-muted",
          size === "lg" ? "w-28 sm:w-32" : "w-20",
        )}
      >
        {line.imageKey && (
          <Image
            src={mediaUrl(line.imageKey)}
            alt=""
            fill
            sizes={size === "lg" ? "128px" : "80px"}
            className={cn("object-cover", unavailable && "grayscale")}
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans text-sm leading-snug font-medium tracking-normal">
            <Link
              href={`/products/${line.productSlug}`}
              onClick={onNavigate}
              className="rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              {line.title}
            </Link>
          </h3>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            disabled={pending}
            onClick={() => startTransition(onRemove)}
            className="-mt-2.5 -mr-2.5 flex size-touch shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {line.colour} · Size {line.size}
        </p>
        <PriceTag pricePaise={line.pricePaise} mrpPaise={line.mrpPaise} />

        {unavailable ? (
          <p className="text-xs font-medium text-destructive">No longer available. Please remove it to continue.</p>
        ) : (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <QuantityStepper
              value={line.qty}
              max={Math.min(MAX_LINE_QTY, Math.max(line.available, line.qty))}
              disabled={pending}
              label={label}
              onChange={(qty) => startTransition(() => onQtyChange(qty))}
            />
            {line.qty > 1 && (
              <p className="text-sm font-semibold tabular-nums">{formatInr(lineTotalPaise(line))}</p>
            )}
          </div>
        )}
        {line.issue === "insufficient_stock" && (
          <p className="text-xs font-medium text-destructive">
            Only {line.available} left. Reduce the quantity to continue.
          </p>
        )}
      </div>
    </article>
  );
}
