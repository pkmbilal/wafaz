"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listingSearchParams, type ListingFilters, type SortOption } from "@/lib/validators/catalog";

const LABELS: Record<SortOption, string> = {
  featured: "Featured",
  relevance: "Most relevant",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export function SortMenu({
  filters,
  defaultSort,
  options,
}: {
  filters: ListingFilters;
  defaultSort: SortOption;
  options: SortOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={filters.sort}
      onValueChange={(value) => {
        const qs = listingSearchParams({ ...filters, sort: value as SortOption, page: 1 }, defaultSort).toString();
        startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
      }}
    >
      <SelectTrigger aria-label="Sort by" aria-busy={isPending} className="min-w-44">
        {/* Explicit label so the server-rendered HTML shows the current sort before hydration. */}
        <SelectValue>{LABELS[filters.sort]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {LABELS[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
