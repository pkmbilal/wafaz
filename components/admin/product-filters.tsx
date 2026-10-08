"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productStatusLabels } from "@/lib/catalog/admin-labels";
import { PRODUCT_STATUSES, type ProductListFilters } from "@/lib/validators/admin-catalog";

// Filter bar for the admin product list. Every change rewrites the URL (page resets to 1).

const ALL = "all";

export function ProductFilters({
  filters,
  categories,
}: {
  filters: ProductListFilters;
  categories: { id: string; path: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();

  function apply(next: Partial<ProductListFilters>) {
    const merged: ProductListFilters = { ...filters, ...next, page: undefined };
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
        <Label htmlFor="product-search" className="sr-only">
          Search products
        </Label>
        <Input
          id="product-search"
          placeholder="Title or SKU"
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value.replace(/[^A-Za-z0-9 -]/g, ""))}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          <Search aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            value={filters.status ?? ALL}
            onValueChange={(v) => apply({ status: v === ALL ? undefined : (v as ProductListFilters["status"]) })}
          >
            <SelectTrigger id="filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {PRODUCT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {productStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-category">Category</Label>
          <Select
            value={filters.category ?? ALL}
            onValueChange={(v) => apply({ category: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="filter-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
