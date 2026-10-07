import { z } from "zod";

export const SORT_OPTIONS = ["featured", "newest", "price_asc", "price_desc", "relevance"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PAGE_SIZE = 24;

type RawSearchParams = Record<string, string | string[] | undefined>;

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : v ? [v] : [])
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 40)
      .slice(0, 20),
  );

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const rupees = z.preprocess(
  first,
  z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined),
);

export const listingFiltersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional().catch(undefined)),
  size: list,
  colour: list,
  fabric: list,
  min: rupees,
  max: rupees,
  sort: z.preprocess(first, z.enum(SORT_OPTIONS).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(500).catch(1).default(1)),
});

export type ListingFilters = {
  query: string | null;
  sizes: string[];
  colours: string[];
  fabrics: string[];
  minPaise: number | null;
  maxPaise: number | null;
  sort: SortOption;
  page: number;
};

export function parseListingFilters(
  searchParams: RawSearchParams,
  defaultSort: SortOption = "featured",
): ListingFilters {
  const parsed = listingFiltersSchema.parse(searchParams);
  const query = parsed.q ? parsed.q : null;
  return {
    query,
    sizes: parsed.size,
    colours: parsed.colour,
    fabrics: parsed.fabric,
    minPaise: parsed.min === undefined ? null : parsed.min * 100,
    maxPaise: parsed.max === undefined ? null : parsed.max * 100,
    sort: parsed.sort ?? defaultSort,
    page: parsed.page,
  };
}

// Builds the query string for a listing URL, dropping defaults so canonical URLs stay clean.
export function listingSearchParams(
  filters: Partial<ListingFilters>,
  defaultSort: SortOption = "featured",
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  for (const s of filters.sizes ?? []) params.append("size", s);
  for (const c of filters.colours ?? []) params.append("colour", c);
  for (const f of filters.fabrics ?? []) params.append("fabric", f);
  if (filters.minPaise != null) params.set("min", String(Math.floor(filters.minPaise / 100)));
  if (filters.maxPaise != null) params.set("max", String(Math.ceil(filters.maxPaise / 100)));
  if (filters.sort && filters.sort !== defaultSort) params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}
