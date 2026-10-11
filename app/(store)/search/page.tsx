import type { Metadata } from "next";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { ListingResults, ListingSkeleton } from "@/components/store/listing-results";
import { Button } from "@/components/ui/button";
import type { SortOption } from "@/lib/validators/catalog";

const SORT_OPTIONS: SortOption[] = ["relevance", "newest", "price_asc", "price_desc"];

export const metadata: Metadata = {
  title: "Search",
  alternates: { canonical: "/search" },
  // Result pages are thin duplicates of listings.
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-6">
      <h1 className="mb-8 text-4xl sm:text-5xl">Search</h1>

      <Suspense fallback={<SearchForm />}>
        <SearchFormWithQuery searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ListingSkeleton />}>
        <ListingResults
          scope={{}}
          searchParams={searchParams}
          basePath="/search"
          defaultSort="relevance"
          sortOptions={SORT_OPTIONS}
          useQueryParam
        />
      </Suspense>
    </div>
  );
}

async function SearchFormWithQuery({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const q = (await searchParams).q;
  return <SearchForm defaultValue={typeof q === "string" ? q : ""} />;
}

// Plain GET form: works without JavaScript and keeps the query in the URL.
function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" role="search" className="mb-8 flex max-w-xl gap-2">
      <label htmlFor="search-q" className="sr-only">
        Search products
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search kurtis, co-ords, fabrics…"
        maxLength={100}
        autoComplete="off"
        className="min-h-12 flex-1 border-0 border-b border-foreground/40 bg-transparent px-1 text-lg outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
      />
      <Button type="submit" aria-label="Search">
        <Search />
        <span className="max-sm:sr-only">Search</span>
      </Button>
    </form>
  );
}
