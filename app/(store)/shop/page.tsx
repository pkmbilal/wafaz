import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ListingResults, ListingSkeleton } from "@/components/store/listing-results";
import type { SortOption } from "@/lib/validators/catalog";

// "Featured" needs a collection's manual order, so the all-products listing sorts by newest.
const SORT_OPTIONS: SortOption[] = ["newest", "price_asc", "price_desc"];

export const metadata: Metadata = {
  title: "Shop all",
  description: "Shop all kurtis, kurti sets, co-ords and kaftans online. Prices include GST.",
  // Filtered / sorted / paginated variants all canonicalise to the clean listing URL.
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-6">
      <Breadcrumbs items={[]} current="Shop all" />
      <header className="mb-10 flex flex-col items-center gap-3 text-center lg:mb-14">
        <h1 className="text-4xl sm:text-5xl">Shop all</h1>
        <span aria-hidden className="h-px w-12 bg-accent" />
      </header>

      <Suspense fallback={<ListingSkeleton />}>
        <ListingResults
          scope={{}}
          searchParams={searchParams}
          basePath="/shop"
          defaultSort="newest"
          sortOptions={SORT_OPTIONS}
        />
      </Suspense>
    </div>
  );
}
