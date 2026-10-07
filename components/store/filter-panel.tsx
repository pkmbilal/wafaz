"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { formatInr } from "@/lib/format";
import { listingSearchParams, type ListingFilters, type SortOption } from "@/lib/validators/catalog";
import type { Facets } from "@/lib/catalog/queries";

type FilterPanelProps = {
  facets: Facets;
  filters: ListingFilters;
  defaultSort: SortOption;
};

export function activeFilterCount(filters: ListingFilters): number {
  return (
    filters.sizes.length +
    filters.colours.length +
    filters.fabrics.length +
    (filters.minPaise != null || filters.maxPaise != null ? 1 : 0)
  );
}

function useFilterNavigation(filters: ListingFilters, defaultSort: SortOption) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const apply = (next: Partial<ListingFilters>) => {
    const params = listingSearchParams({ ...filters, ...next, page: 1 }, defaultSort);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return { apply, isPending };
}

// Remounts the controls when the URL price range changes, so the slider's local state resets.
const priceKey = (f: ListingFilters) => `${f.minPaise ?? ""}-${f.maxPaise ?? ""}`;

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterControls({ facets, filters, defaultSort }: FilterPanelProps) {
  const { apply, isPending } = useFilterNavigation(filters, defaultSort);

  const minRupees = Math.floor((facets.minPaise ?? 0) / 100);
  const maxRupees = Math.ceil((facets.maxPaise ?? 0) / 100);
  const [price, setPrice] = useState<[number, number]>([
    filters.minPaise != null ? filters.minPaise / 100 : minRupees,
    filters.maxPaise != null ? filters.maxPaise / 100 : maxRupees,
  ]);

  return (
    <div aria-busy={isPending} className={cn("transition-opacity", isPending && "opacity-60")}>
      <Accordion type="multiple" defaultValue={["size", "colour", "price", "fabric"]}>
        {facets.sizes.length > 0 && (
          <AccordionItem value="size">
            <AccordionTrigger>Size</AccordionTrigger>
            <AccordionContent>
              <div role="group" aria-label="Size" className="flex flex-wrap gap-2">
                {facets.sizes.map((size) => {
                  const selected = filters.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => apply({ sizes: toggle(filters.sizes, size) })}
                      className={cn(
                        "min-h-touch min-w-touch rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-foreground hover:border-primary",
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {facets.colours.length > 0 && (
          <AccordionItem value="colour">
            <AccordionTrigger>Colour</AccordionTrigger>
            <AccordionContent>
              <ul className="grid grid-cols-2 gap-x-2">
                {facets.colours.map((c) => (
                  <li key={c.name}>
                    <label className="flex min-h-touch cursor-pointer items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={filters.colours.includes(c.name)}
                        onCheckedChange={() => apply({ colours: toggle(filters.colours, c.name) })}
                      />
                      <span
                        aria-hidden
                        className="size-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: c.hex ?? undefined }}
                      />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {maxRupees > minRupees && (
          <AccordionItem value="price">
            <AccordionTrigger>Price</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-4 px-2 pt-2">
                <Slider
                  min={minRupees}
                  max={maxRupees}
                  step={100}
                  value={price}
                  minStepsBetweenThumbs={1}
                  onValueChange={(v) => setPrice([v[0], v[1]])}
                  onValueCommit={(v) =>
                    apply({
                      minPaise: v[0] > minRupees ? v[0] * 100 : null,
                      maxPaise: v[1] < maxRupees ? v[1] * 100 : null,
                    })
                  }
                  aria-label="Price range"
                />
                <p className="flex justify-between text-sm text-foreground" aria-live="polite">
                  <span>{formatInr(price[0] * 100)}</span>
                  <span>{formatInr(price[1] * 100)}</span>
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {facets.fabrics.length > 0 && (
          <AccordionItem value="fabric">
            <AccordionTrigger>Fabric</AccordionTrigger>
            <AccordionContent>
              <ul>
                {facets.fabrics.map((fabric) => (
                  <li key={fabric}>
                    <label className="flex min-h-touch cursor-pointer items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={filters.fabrics.includes(fabric)}
                        onCheckedChange={() => apply({ fabrics: toggle(filters.fabrics, fabric) })}
                      />
                      {fabric}
                    </label>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {activeFilterCount(filters) > 0 && (
        <Button
          variant="link"
          className="mt-2 px-0"
          onClick={() => apply({ sizes: [], colours: [], fabrics: [], minPaise: null, maxPaise: null })}
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}

// Desktop: always-visible sidebar.
export function FilterSidebar(props: FilterPanelProps) {
  return (
    <aside aria-label="Filters" className="hidden w-60 shrink-0 lg:block">
      <h2 className="mb-2 font-sans text-xs font-semibold tracking-widest uppercase">Filter</h2>
      <FilterControls key={priceKey(props.filters)} {...props} />
    </aside>
  );
}

// Mobile / tablet: filters in a sheet.
export function FilterSheet(props: FilterPanelProps & { total: number }) {
  const count = activeFilterCount(props.filters);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal />
          Filters{count > 0 ? ` (${count})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[90%] max-w-sm">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FilterControls key={priceKey(props.filters)} {...props} />
        </div>
        <SheetFooter className="border-t border-border">
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {props.total} {props.total === 1 ? "product" : "products"}
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
