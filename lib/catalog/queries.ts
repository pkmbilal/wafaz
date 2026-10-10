import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import { compareSizes } from "@/lib/catalog/sizes";
import { PAGE_SIZE, type ListingFilters } from "@/lib/validators/catalog";
import type { Json } from "@/types/database";

// Every catalog read for storefront pages. All functions are cached, tagged with names from
// lib/cache-tags.ts, and use the cookie-less public client, so no catalog page creates a session.

export type ColourOption = { name: string; hex: string | null };

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  pricePaise: number;
  mrpPaise: number;
  inStock: boolean;
  isNew: boolean;
  imageKey: string | null;
  imageAlt: string | null;
  colours: ColourOption[];
};

export type ListingScope = {
  collectionSlug?: string;
  categorySlug?: string;
  query?: string;
};

export type ListingResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export type Facets = {
  sizes: string[];
  colours: ColourOption[];
  fabrics: string[];
  minPaise: number | null;
  maxPaise: number | null;
};

export type Crumb = { name: string; href: string };

export type ListingTarget = {
  kind: "collection" | "category";
  slug: string;
  title: string;
  description: string | null;
  breadcrumb: Crumb[];
};

export type NavCategory = {
  name: string;
  slug: string;
  imageKey: string | null;
  children: { name: string; slug: string }[];
};

type QueryResult = { data: unknown; error: { message: string } | null };

function checkMaybe<R extends QueryResult>(result: R): NonNullable<R["data"]> | null {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? null) as NonNullable<R["data"]> | null;
}

function check<R extends QueryResult>(result: R): NonNullable<R["data"]> {
  const data = checkMaybe(result);
  if (data === null) throw new Error("Expected data from Supabase, got null");
  return data;
}

function parseColours(value: Json): ColourOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c) =>
    c && typeof c === "object" && !Array.isArray(c) && typeof c.name === "string"
      ? [{ name: c.name, hex: typeof c.hex === "string" ? c.hex : null }]
      : [],
  );
}

// ---------------------------------------------------------------------------
// Settings and navigation
// ---------------------------------------------------------------------------

export async function getStoreSettings() {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.settings);

  const supabase = createPublicClient();
  return check(await supabase.from("public_store_settings").select("*").single());
}

export type IndianState = { code: string; name: string };

// GST state codes, for address forms. Reference data, so it shares the settings tag.
export async function getIndianStates(): Promise<IndianState[]> {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.settings);

  const supabase = createPublicClient();
  return check(await supabase.from("indian_states").select("code, name").order("name"));
}

export async function getNavCategories(): Promise<NavCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const supabase = createPublicClient();
  const rows = check(
    await supabase
      .from("categories")
      .select("id, parent_id, name, slug, image_key, sort_order")
      .order("sort_order")
      .order("name"),
  );

  return rows
    .filter((c) => c.parent_id === null)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      imageKey: c.image_key,
      children: rows
        .filter((child) => child.parent_id === c.id)
        .map((child) => ({ name: child.name, slug: child.slug })),
    }));
}

// ---------------------------------------------------------------------------
// Listings (collections, categories, search)
// ---------------------------------------------------------------------------

export async function getListingTarget(slug: string): Promise<ListingTarget | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog, cacheTags.collection(slug));

  const supabase = createPublicClient();

  const collection = checkMaybe(
    await supabase.from("collections").select("slug, title, description").eq("slug", slug).maybeSingle(),
  );
  if (collection) {
    return {
      kind: "collection",
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      breadcrumb: [{ name: collection.title, href: `/collections/${collection.slug}` }],
    };
  }

  const categories = check(await supabase.from("categories").select("id, parent_id, name, slug"));
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;

  const breadcrumb: Crumb[] = [];
  for (let c: typeof category | undefined = category; c; ) {
    breadcrumb.unshift({ name: c.name, href: `/collections/${c.slug}` });
    const parentId: string | null = c.parent_id;
    c = parentId ? categories.find((p) => p.id === parentId) : undefined;
  }

  return { kind: "category", slug: category.slug, title: category.name, description: null, breadcrumb };
}

export async function getListing(scope: ListingScope, filters: ListingFilters): Promise<ListingResult> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);
  if (scope.collectionSlug) cacheTag(cacheTags.collection(scope.collectionSlug));
  if (scope.categorySlug) cacheTag(cacheTags.collection(scope.categorySlug));

  const [settings, rows] = await Promise.all([
    getStoreSettings(),
    createPublicClient()
      .rpc("catalog_products", {
        p_collection_slug: scope.collectionSlug,
        p_category_slug: scope.categorySlug,
        p_query: scope.query,
        p_sizes: filters.sizes,
        p_colours: filters.colours,
        p_fabrics: filters.fabrics,
        p_min_paise: filters.minPaise ?? undefined,
        p_max_paise: filters.maxPaise ?? undefined,
        p_sort: filters.sort,
        p_limit: PAGE_SIZE,
        p_offset: (filters.page - 1) * PAGE_SIZE,
      })
      .then(check),
  ]);

  const newSince = Date.now() - (settings.new_badge_days ?? 30) * 86_400_000;
  const total = rows[0]?.total_count ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      pricePaise: r.price_paise,
      mrpPaise: r.mrp_paise,
      inStock: r.in_stock,
      isNew: r.published_at ? new Date(r.published_at).getTime() >= newSince : false,
      imageKey: r.image_key,
      imageAlt: r.image_alt,
      colours: parseColours(r.colours),
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getFacets(scope: ListingScope): Promise<Facets> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const data = check(
    await createPublicClient().rpc("catalog_facets", {
      p_collection_slug: scope.collectionSlug,
      p_category_slug: scope.categorySlug,
      p_query: scope.query,
    }),
  );
  const f = (data ?? {}) as { [key: string]: Json | undefined };
  const strings = (v: Json | undefined) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    sizes: strings(f.sizes),
    colours: parseColours(f.colours ?? []),
    fabrics: strings(f.fabrics),
    minPaise: typeof f.min_paise === "number" ? f.min_paise : null,
    maxPaise: typeof f.max_paise === "number" ? f.max_paise : null,
  };
}

const defaultFilters: ListingFilters = {
  query: null,
  sizes: [],
  colours: [],
  fabrics: [],
  minPaise: null,
  maxPaise: null,
  sort: "featured",
  page: 1,
};

export async function getHomeData() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const supabase = createPublicClient();
  const [banners, categories, newArrivals, bestSellers] = await Promise.all([
    supabase
      .from("banners")
      .select("id, title, image_key, link")
      .eq("placement", "hero")
      .order("sort_order")
      .then(check),
    getNavCategories(),
    getListing({ collectionSlug: "new-arrivals" }, defaultFilters),
    getListing({ collectionSlug: "best-sellers" }, defaultFilters),
  ]);

  return {
    banners,
    categories,
    newArrivals: newArrivals.items.slice(0, 8),
    bestSellers: bestSellers.items.slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export type ProductVariant = {
  id: string;
  size: string;
  colour: string;
  colourHex: string | null;
  pricePaise: number;
  mrpPaise: number;
};

export type ProductMedia = { id: string; colour: string | null; key: string; alt: string | null };

export type SizeChartData = {
  unit: string;
  columns: string[];
  rows: (string | number)[][];
  note?: string;
};

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const supabase = createPublicClient();
  const product = checkMaybe(
    await supabase
      .from("products")
      .select(
        `id, slug, title, description, fabric, style, occasion, care, country_of_origin,
         seo_title, seo_description, category_id,
         size_chart:size_charts ( name, data ),
         product_variants ( id, sku, size, colour, colour_hex, price_paise, mrp_paise, is_active ),
         product_media ( id, colour, r2_key, alt, sort_order ),
         product_tags ( tags ( name, slug ) )`,
      )
      .eq("slug", slug)
      .maybeSingle(),
  );
  if (!product) return null;
  cacheTag(cacheTags.product(product.id));

  const categories = check(await supabase.from("categories").select("id, parent_id, name, slug"));
  const breadcrumb: Crumb[] = [];
  for (let c = categories.find((x) => x.id === product.category_id); c; ) {
    breadcrumb.unshift({ name: c.name, href: `/collections/${c.slug}` });
    const parentId: string | null = c.parent_id;
    c = parentId ? categories.find((p) => p.id === parentId) : undefined;
  }

  const variants: ProductVariant[] = product.product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => compareSizes(a.size, b.size))
    .map((v) => ({
      id: v.id,
      size: v.size,
      colour: v.colour,
      colourHex: v.colour_hex,
      pricePaise: v.price_paise,
      mrpPaise: v.mrp_paise,
    }));

  // Colours follow the order of their first image, so the default colour matches the lead photo.
  const firstImage = (colour: string) =>
    Math.min(...product.product_media.filter((m) => m.colour === colour).map((m) => m.sort_order), Infinity);
  const colours: ColourOption[] = [];
  for (const v of [...product.product_variants].sort(
    (a, b) => firstImage(a.colour) - firstImage(b.colour) || a.sku.localeCompare(b.sku),
  )) {
    if (v.is_active && !colours.some((c) => c.name === v.colour)) {
      colours.push({ name: v.colour, hex: v.colour_hex });
    }
  }

  const media: ProductMedia[] = [...product.product_media]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ id: m.id, colour: m.colour, key: m.r2_key, alt: m.alt }));

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    fabric: product.fabric,
    style: product.style,
    occasion: product.occasion,
    care: product.care,
    countryOfOrigin: product.country_of_origin,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    sizeChart: product.size_chart
      ? { name: product.size_chart.name, data: product.size_chart.data as unknown as SizeChartData }
      : null,
    tags: product.product_tags.flatMap((pt) => (pt.tags ? [pt.tags] : [])),
    breadcrumb,
    variants,
    colours,
    media,
  };
}

export type Product = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

// Available units per variant. Short-lived because reservations change it without an admin
// mutation; checkout always re-checks stock in the DB.
export async function getVariantAvailability(productId: string): Promise<Record<string, number>> {
  "use cache";
  cacheLife("seconds");
  cacheTag(cacheTags.product(productId));

  const rows = check(
    await createPublicClient()
      .from("product_variants")
      .select("id, stock, reserved")
      .eq("product_id", productId),
  );
  return Object.fromEntries(rows.map((r) => [r.id, Math.max(0, r.stock - r.reserved)]));
}

// ---------------------------------------------------------------------------
// Content pages and static params
// ---------------------------------------------------------------------------

export async function getPage(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.page(slug));

  return checkMaybe(
    await createPublicClient()
      .from("pages")
      .select("slug, title, body, seo_title, seo_description, updated_at")
      .eq("slug", slug)
      .maybeSingle(),
  );
}

export async function getStaticSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const supabase = createPublicClient();
  const [products, collections, categories, pages] = await Promise.all([
    supabase.from("products").select("slug").then(check),
    supabase.from("collections").select("slug").then(check),
    supabase.from("categories").select("slug").then(check),
    supabase.from("pages").select("slug").then(check),
  ]);
  return {
    products: products.map((p) => p.slug),
    listings: [...collections, ...categories].map((c) => c.slug),
    pages: pages.map((p) => p.slug),
  };
}

export type SitemapEntry = { path: string; updatedAt: string };

// RLS limits anon reads to active products, collections, categories and published pages,
// so only public URLs end up in the sitemap.
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.catalog);

  const supabase = createPublicClient();
  const [products, collections, categories, pages] = await Promise.all([
    supabase.from("products").select("slug, updated_at").then(check),
    supabase.from("collections").select("slug, updated_at").then(check),
    supabase.from("categories").select("slug, updated_at").then(check),
    supabase.from("pages").select("slug, updated_at").then(check),
  ]);
  return [
    ...products.map((r) => ({ path: `/products/${r.slug}`, updatedAt: r.updated_at })),
    ...[...collections, ...categories].map((r) => ({ path: `/collections/${r.slug}`, updatedAt: r.updated_at })),
    ...pages.map((r) => ({ path: `/pages/${r.slug}`, updatedAt: r.updated_at })),
  ];
}
