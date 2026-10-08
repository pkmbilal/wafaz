"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fulfillmentStatusLabels, orderStatusLabels, paymentStatusLabels } from "@/lib/orders/labels";
import type { OrderFilters as Filters } from "@/lib/validators/admin-orders";

// Filter bar for the admin order list. Every change rewrites the URL (page resets to 1), so the
// list stays shareable and the server renders the filtered page.

const ALL = "all";

export function OrderFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();

  function apply(next: Partial<Filters>) {
    const merged: Filters = { ...filters, ...next, page: undefined };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-busy={pending}>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || undefined });
        }}
      >
        <Label htmlFor="order-search" className="sr-only">
          Search orders
        </Label>
        <Input
          id="order-search"
          placeholder="Order number, email or phone"
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value.replace(/[^A-Za-z0-9@.+_-]/g, ""))}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          <Search aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusSelect
          label="Order"
          value={filters.order}
          options={orderStatusLabels}
          onChange={(order) => apply({ order: order as Filters["order"] })}
        />
        <StatusSelect
          label="Payment"
          value={filters.payment}
          options={paymentStatusLabels}
          onChange={(payment) => apply({ payment: payment as Filters["payment"] })}
        />
        <StatusSelect
          label="Fulfilment"
          value={filters.fulfillment}
          options={fulfillmentStatusLabels}
          onChange={(fulfillment) => apply({ fulfillment: fulfillment as Filters["fulfillment"] })}
        />
        <div className="flex min-h-touch items-center gap-3 self-end">
          <Switch
            id="attention-only"
            checked={filters.attention === "1"}
            onCheckedChange={(on) => apply({ attention: on ? "1" : undefined })}
          />
          <Label htmlFor="attention-only">Needs attention only</Label>
        </div>
      </div>
    </div>
  );
}

function StatusSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Record<string, string>;
  onChange: (value: string | undefined) => void;
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
