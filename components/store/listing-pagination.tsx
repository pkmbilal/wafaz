import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { listingSearchParams, type ListingFilters, type SortOption } from "@/lib/validators/catalog";

// Page numbers to show: first, last, and a window around the current page.
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

export function ListingPagination({
  basePath,
  filters,
  pageCount,
  defaultSort,
}: {
  basePath: string;
  filters: ListingFilters;
  pageCount: number;
  defaultSort: SortOption;
}) {
  if (pageCount <= 1) return null;

  const href = (page: number) => {
    const qs = listingSearchParams({ ...filters, page }, defaultSort).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <Pagination className="mt-12">
      <PaginationContent>
        {filters.page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={href(filters.page - 1)} />
          </PaginationItem>
        )}
        {pageWindow(filters.page, pageCount).map((p, i) =>
          p === "gap" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink href={href(p)} isActive={p === filters.page}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        {filters.page < pageCount && (
          <PaginationItem>
            <PaginationNext href={href(filters.page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
