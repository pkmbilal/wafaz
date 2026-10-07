import { cn } from "cn";
import { discountPercent, formatInr } from "@/lib/format";

type PriceTagProps = {
  pricePaise: number;
  mrpPaise: number;
  size?: "sm" | "lg";
  className?: string;
};

export function PriceTag({ pricePaise, mrpPaise, size = "sm", className }: PriceTagProps) {
  const off = discountPercent(mrpPaise, pricePaise);

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-semibold text-foreground", size === "lg" ? "text-2xl" : "text-sm")}>
        <span className="sr-only">Price </span>
        {formatInr(pricePaise)}
      </span>
      {off > 0 && (
        <>
          <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">MRP </span>
            {formatInr(mrpPaise)}
          </span>
          <span className={cn("font-semibold text-sale", size === "lg" ? "text-base" : "text-xs")}>
            {off}% off
          </span>
        </>
      )}
    </p>
  );
}
