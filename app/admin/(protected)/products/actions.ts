"use server";

import { refresh, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, dbErrorMessage, firstIssue } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { cacheTags } from "@/lib/cache-tags";
import { isValidUploadedObject } from "@/lib/r2-upload";
import { createClient } from "@/lib/supabase/server";
import { isUploadKey } from "@/lib/uploads";
import {
  addMediaSchema,
  adjustStockSchema,
  deleteMediaSchema,
  type ProductDetails,
  productCollectionsSchema,
  productDetailsSchema,
  productTagsSchema,
  reorderMediaSchema,
  saveVariantsSchema,
  updateMediaSchema,
  updateProductSchema,
} from "@/lib/validators/admin-catalog";

// Product admin actions (owner and staff). Each checks the role, validates its input, and writes
// as the signed-in admin, so the catalog RLS policies and column grants apply as well. Stock only
// changes through admin_adjust_stock (AGENTS.md §5.5).

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Every catalog page is tagged `catalog`; the product tag also clears its short-lived stock cache.
function revalidateProduct(productId: string) {
  revalidateTag(cacheTags.product(productId), "max");
  revalidateTag(cacheTags.catalog, "max");
}

// Checkout needs a GST slab for the product's HSN code (AGENTS.md §5.2), so catch a typo here.
async function checkHsn(supabase: Supabase, hsnCode: string): Promise<string | null> {
  const { count } = await supabase
    .from("tax_slabs")
    .select("id", { count: "exact", head: true })
    .eq("hsn_code", hsnCode);
  return count ? null : `There's no GST slab for HSN ${hsnCode}. Add one in tax slabs or check the code.`;
}

function productRow(d: ProductDetails) {
  return {
    title: d.title,
    slug: d.slug,
    category_id: d.categoryId,
    hsn_code: d.hsnCode,
    description: d.description,
    fabric: d.fabric,
    style: d.style,
    occasion: d.occasion,
    care: d.care,
    country_of_origin: d.countryOfOrigin,
    size_chart_id: d.sizeChartId,
    status: d.status,
    seo_title: d.seoTitle,
    seo_description: d.seoDescription,
  };
}

// New products start as drafts; they can be published once they have a variant.
export async function createProduct(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const hsnError = await checkHsn(supabase, parsed.data.hsnCode);
  if (hsnError) return { ok: false, error: hsnError };

  const { data, error } = await supabase
    .from("products")
    .insert({ ...productRow(parsed.data), status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  redirect(`/admin/products/${data.id}`);
}

export async function updateProduct(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...details } = parsed.data;

  const supabase = await createClient();
  const hsnError = await checkHsn(supabase, details.hsnCode);
  if (hsnError) return { ok: false, error: hsnError };

  if (details.status === "active") {
    const { count } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)
      .eq("is_active", true);
    if (!count) return { ok: false, error: "Add at least one active variant before publishing." };
  }

  const { error } = await supabase.from("products").update(productRow(details)).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(id);
  refresh();
  return { ok: true, message: "Product saved" };
}

export async function saveVariants(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = saveVariantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_variants", {
    p_product_id: parsed.data.productId,
    p_variants: parsed.data.variants.map((v) => ({
      id: v.id ?? null,
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      colour_hex: v.colourHex,
      mrp_paise: v.mrp,
      price_paise: v.price,
      weight_grams: v.weightGrams,
      is_active: v.isActive,
      ...(v.id ? {} : { stock: v.stock ?? 0 }),
    })),
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Couldn't save the variants. Please try again.") };
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true, message: "Variants saved" };
}

export async function adjustStock(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_stock", {
    p_variant_id: parsed.data.variantId,
    p_delta: parsed.data.delta,
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Couldn't update the stock. Please try again.") };
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true, message: `Stock is now ${data}` };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
export async function addMedia(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = addMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { productId, key, colour, alt } = parsed.data;
  if (!isUploadKey(key, "product", productId) || !(await isValidUploadedObject(key))) {
    return { ok: false, error: "The upload didn't finish. Please try again." };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("product_media")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("product_media").insert({
    product_id: productId,
    r2_key: key,
    colour,
    alt,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(productId);
  refresh();
  return { ok: true, message: "Image added" };
}

export async function updateMedia(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { productId, mediaId, colour, alt } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_media")
    .update({ colour, alt })
    .eq("id", mediaId)
    .eq("product_id", productId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(productId);
  refresh();
  return { ok: true, message: "Image updated" };
}

// Removes the image from the product. TODO(owner): the R2 object is left in the bucket; add a
// periodic cleanup of unreferenced keys if storage use grows.
export async function deleteMedia(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = deleteMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_media")
    .delete()
    .eq("id", parsed.data.mediaId)
    .eq("product_id", parsed.data.productId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true, message: "Image removed" };
}

export async function reorderMedia(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = reorderMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_media", {
    p_product_id: parsed.data.productId,
    p_media_ids: parsed.data.mediaIds,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tags and collections
// ---------------------------------------------------------------------------
export async function setProductTags(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productTagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_product_tags", {
    p_product_id: parsed.data.productId,
    p_tag_ids: parsed.data.tagIds,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true, message: "Tags saved" };
}

export async function setProductCollections(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productCollectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("collection_products")
    .select("collections ( slug )")
    .eq("product_id", parsed.data.productId);
  const { error } = await supabase.rpc("admin_set_product_collections", {
    p_product_id: parsed.data.productId,
    p_collection_ids: parsed.data.collectionIds,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const { data: after } = parsed.data.collectionIds.length
    ? await supabase.from("collections").select("slug").in("id", parsed.data.collectionIds)
    : { data: [] };
  const slugs = new Set([
    ...(before ?? []).flatMap((r) => (r.collections ? [r.collections.slug] : [])),
    ...(after ?? []).map((c) => c.slug),
  ]);
  for (const slug of slugs) revalidateTag(cacheTags.collection(slug), "max");
  revalidateProduct(parsed.data.productId);
  refresh();
  return { ok: true, message: "Collections saved" };
}
