import "server-only";
import type { SizeChartData } from "@/lib/catalog/queries";
import { compareSizes } from "@/lib/catalog/sizes";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTS_PAGE_SIZE, type ProductListFilters, type ProductStatus } from "@/lib/validators/admin-catalog";

// Admin catalog reads. They run as the signed-in admin, so RLS returns drafts, archived products
// and inactive rows too; the admin layout has already checked the role. Writes go through the
// Server Actions next to each page.

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

// ---------------------------------------------------------------------------
// Reference lists for the forms
// ---------------------------------------------------------------------------
export type AdminCategory = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  imageKey: string | null;
  sortOrder: number;
  isActive: boolean;
  depth: number;
  // "Kurtis › Straight Kurtis"
  path: string;
  productCount: number;
};

// Depth-first, siblings by sort order then name, so the list reads as a tree.
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase.from("categories").select("id, parent_id, name, slug, image_key, sort_order, is_active, products(count)"),
  );
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }
  const out: AdminCategory[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    const children = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    for (const c of children) {
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({
        id: c.id,
        parentId: c.parent_id,
        name: c.name,
        slug: c.slug,
        imageKey: c.image_key,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        depth,
        path,
        productCount: c.products[0]?.count ?? 0,
      });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

export type AdminTag = { id: string; name: string; slug: string; productCount: number };

export async function listAdminTags(): Promise<AdminTag[]> {
  const supabase = await createClient();
  const rows = check(await supabase.from("tags").select("id, name, slug, product_tags(count)").order("name"));
  return rows.map((t) => ({ id: t.id, name: t.name, slug: t.slug, productCount: t.product_tags[0]?.count ?? 0 }));
}

export type AdminSizeChart = { id: string; name: string; data: SizeChartData; productCount: number };

export async function listAdminSizeCharts(): Promise<AdminSizeChart[]> {
  const supabase = await createClient();
  const rows = check(await supabase.from("size_charts").select("id, name, data, products(count)").order("name"));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    data: s.data as unknown as SizeChartData,
    productCount: s.products[0]?.count ?? 0,
  }));
}

export type AdminCollection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageKey: string | null;
  isActive: boolean;
  productCount: number;
};

export async function listAdminCollections(): Promise<AdminCollection[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("collections")
      .select("id, title, slug, description, image_key, is_active, collection_products(count)")
      .order("title"),
  );
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    imageKey: c.image_key,
    isActive: c.is_active,
    productCount: c.collection_products[0]?.count ?? 0,
  }));
}

export type AdminProductSummary = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  imageKey: string | null;
};

export async function getAdminCollection(id: string) {
  const supabase = await createClient();
  const collection = checkMaybe(
    await supabase
      .from("collections")
      .select(
        `id, title, slug, description, image_key, is_active,
         collection_products ( sort_order, products ( id, title, slug, status, product_media ( r2_key, sort_order ) ) )`,
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!collection) return null;
  const products: AdminProductSummary[] = [...collection.collection_products]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((cp) => (cp.products ? [cp.products] : []))
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status as ProductStatus,
      imageKey: [...p.product_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
    }));
  return {
    collection: {
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      imageKey: collection.image_key,
      isActive: collection.is_active,
      productCount: products.length,
    } satisfies AdminCollection,
    products,
  };
}

export type BannerState = "off" | "scheduled" | "ended" | "live";

export type AdminBanner = {
  id: string;
  title: string;
  imageKey: string;
  link: string | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  state: BannerState;
};

export async function listAdminBanners(): Promise<AdminBanner[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("banners")
      .select("id, title, image_key, link, sort_order, starts_at, ends_at, is_active")
      .order("sort_order")
      .order("created_at"),
  );
  const now = Date.now();
  const state = (b: (typeof rows)[number]): BannerState => {
    if (!b.is_active) return "off";
    if (b.starts_at && new Date(b.starts_at).getTime() > now) return "scheduled";
    if (b.ends_at && new Date(b.ends_at).getTime() <= now) return "ended";
    return "live";
  };
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    imageKey: b.image_key,
    link: b.link,
    sortOrder: b.sort_order,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    isActive: b.is_active,
    state: state(b),
  }));
}

// HSN codes that have a GST slab, offered as suggestions on the product form.
export async function listTaxHsnCodes(): Promise<string[]> {
  const supabase = await createClient();
  const rows = check(await supabase.from("tax_slabs").select("hsn_code"));
  return [...new Set(rows.map((r) => r.hsn_code))].sort();
}

// ---------------------------------------------------------------------------
// Product list
// ---------------------------------------------------------------------------
export type AdminProductListItem = AdminProductSummary & {
  categoryName: string | null;
  variantCount: number;
  available: number;
  minPricePaise: number | null;
  maxPricePaise: number | null;
  updatedAt: string;
};

export async function listAdminProducts(
  filters: ProductListFilters,
): Promise<{ products: AdminProductListItem[]; total: number; page: number; pageCount: number }> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(
      `id, title, slug, status, updated_at, categories ( name ),
       product_variants ( price_paise, stock, reserved, is_active ),
       product_media ( r2_key, sort_order )`,
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, from + PRODUCTS_PAGE_SIZE - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.q) {
    // q is limited to [A-Za-z0-9 -] by the validator, so it can't break out of the filter.
    const q = filters.q;
    const skuMatches = check(
      await supabase.from("product_variants").select("product_id").ilike("sku", `%${q}%`).limit(50),
    );
    const ids = [...new Set(skuMatches.map((v) => v.product_id))];
    query = ids.length
      ? query.or(`title.ilike."%${q}%",id.in.(${ids.join(",")})`)
      : query.ilike("title", `%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    products: data.map((p) => {
      const active = p.product_variants.filter((v) => v.is_active);
      const prices = active.map((v) => v.price_paise);
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status as ProductStatus,
        imageKey: [...p.product_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
        categoryName: p.categories?.name ?? null,
        variantCount: p.product_variants.length,
        available: active.reduce((sum, v) => sum + v.stock - v.reserved, 0),
        minPricePaise: prices.length ? Math.min(...prices) : null,
        maxPricePaise: prices.length ? Math.max(...prices) : null,
        updatedAt: p.updated_at,
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}

// For the collection screen's "add product" search.
export async function searchAdminProducts(q: string): Promise<AdminProductSummary[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("products")
      .select("id, title, slug, status, product_media ( r2_key, sort_order )")
      .ilike("title", `%${q.replace(/[%_\\]/g, "")}%`)
      .neq("status", "archived")
      .order("title")
      .limit(10),
  );
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status as ProductStatus,
    imageKey: [...p.product_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Product detail (edit screen)
// ---------------------------------------------------------------------------
export type AdminVariant = {
  id: string;
  sku: string;
  size: string;
  colour: string;
  colourHex: string | null;
  mrpPaise: number;
  pricePaise: number;
  weightGrams: number;
  stock: number;
  reserved: number;
  isActive: boolean;
};

export type AdminMedia = { id: string; key: string; colour: string | null; alt: string | null };

export async function getAdminProduct(id: string) {
  const supabase = await createClient();
  const p = checkMaybe(
    await supabase
      .from("products")
      .select(
        `id, title, slug, category_id, hsn_code, description, fabric, style, occasion, care,
         country_of_origin, size_chart_id, status, seo_title, seo_description, published_at, updated_at,
         product_variants ( id, sku, size, colour, colour_hex, mrp_paise, price_paise, weight_grams, stock, reserved, is_active ),
         product_media ( id, r2_key, colour, alt, sort_order ),
         product_tags ( tag_id ),
         collection_products ( collection_id )`,
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!p) return null;

  const variants: AdminVariant[] = [...p.product_variants]
    .sort((a, b) => a.colour.localeCompare(b.colour) || compareSizes(a.size, b.size))
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      colourHex: v.colour_hex,
      mrpPaise: v.mrp_paise,
      pricePaise: v.price_paise,
      weightGrams: v.weight_grams,
      stock: v.stock,
      reserved: v.reserved,
      isActive: v.is_active,
    }));

  return {
    id: p.id,
    status: p.status as ProductStatus,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    details: {
      title: p.title,
      slug: p.slug,
      categoryId: p.category_id,
      hsnCode: p.hsn_code,
      description: p.description ?? "",
      fabric: p.fabric ?? "",
      style: p.style ?? "",
      occasion: p.occasion ?? "",
      care: p.care ?? "",
      countryOfOrigin: p.country_of_origin,
      sizeChartId: p.size_chart_id ?? "",
      status: p.status as ProductStatus,
      seoTitle: p.seo_title ?? "",
      seoDescription: p.seo_description ?? "",
    },
    variants,
    media: [...p.product_media]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m): AdminMedia => ({ id: m.id, key: m.r2_key, colour: m.colour, alt: m.alt })),
    tagIds: p.product_tags.map((t) => t.tag_id),
    collectionIds: p.collection_products.map((c) => c.collection_id),
  };
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;
