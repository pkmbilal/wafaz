import { cn } from "cn";
import { formatInr } from "@/lib/format";

type OrderTotals = {
  subtotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  shippingPaise: number;
  totalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

// Totals with the GST that is included in them (prices are GST-inclusive).
export function OrderSummary({ totals, title = "Order summary" }: { totals: OrderTotals; title?: string }) {
  const gst = totals.cgstPaise + totals.sgstPaise + totals.igstPaise;

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Subtotal" value={formatInr(totals.subtotalPaise)} />
        {totals.discountPaise > 0 && (
          <Row
            label={totals.couponCode ? `Coupon ${totals.couponCode}` : "Discount"}
            value={`−${formatInr(totals.discountPaise)}`}
            className="text-sale"
          />
        )}
        <Row label="Shipping" value={totals.shippingPaise === 0 ? "Free" : formatInr(totals.shippingPaise)} />
        <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatInr(totals.totalPaise)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Includes {formatInr(gst)} GST
        {totals.igstPaise > 0
          ? ` (IGST ${formatInr(totals.igstPaise)})`
          : gst > 0
            ? ` (CGST ${formatInr(totals.cgstPaise)} + SGST ${formatInr(totals.sgstPaise)})`
            : ""}
        .
      </p>
    </section>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between", className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
