import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/store/empty-state";
import { FilterSheet, FilterSidebar } from "@/components/store/filter-panel";
import { ListingPagination } from "@/components/store/listing-pagination";
import { ProductGrid } from "@/components/store/product-card";
import { SortMenu } from "@/components/store/sort-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getFacets, getListing, type ListingScope } from "@/lib/catalog/queries";
import { parseListingFilters, type SortOption } from "@/lib/validators/catalog";

type ListingResultsProps = {
  scope: ListingScope;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  defaultSort: SortOption;
  sortOptions: SortOption[];
  // Search pages take the query from the URL; collection pages don't.
  useQueryParam?: boolean;
};

// Reads searchParams, so it must render inside <Suspense>. The data calls stay cached.
export async function ListingResults({
  scope,
  searchParams,
  basePath,
  defaultSort,
  sortOptions,
  useQueryParam = false,
}: ListingResultsProps) {
  const filters = parseListingFilters(await searchParams, defaultSort);
  const fullScope: ListingScope = useQueryParam ? { ...scope, query: filters.query ?? undefined } : scope;
  const listingFilters = useQueryParam ? filters : { ...filters, query: null };

  const [listing, facets] = await Promise.all([
    getListing(fullScope, listingFilters),
    getFacets(fullScope),
  ]);

  const panelProps = { facets, filters: listingFilters, defaultSort };

  return (
    <div className="flex gap-10">
      <FilterSidebar {...panelProps} />

      <section aria-label="Products" className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {listing.total} {listing.total === 1 ? "product" : "products"}
          </p>
          <div className="flex items-center gap-2">
            <FilterSheet {...panelProps} total={listing.total} />
            <SortMenu filters={listingFilters} defaultSort={defaultSort} options={sortOptions} />
          </div>
        </div>

        {listing.items.length > 0 ? (
          <>
            <ProductGrid products={listing.items} eagerCount={4} />
            <ListingPagination
              basePath={basePath}
              filters={listingFilters}
              pageCount={listing.pageCount}
              defaultSort={defaultSort}
            />
          </>
        ) : (
          <EmptyState
            icon={SearchX}
            title="Nothing matches yet"
            description="Try removing a filter or searching for something else."
            action={{ label: "See new arrivals", href: "/collections/new-arrivals" }}
          />
        )}
      </section>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="flex gap-10" aria-hidden>
      <div className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <Skeleton className="mb-6 h-11 w-full" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-4/5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
