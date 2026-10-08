"use server";

import { refresh, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, dbErrorMessage, firstIssue } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { type AdminProductSummary, searchAdminProducts } from "@/lib/catalog/admin-queries";
import { cacheTags } from "@/lib/cache-tags";
import { isValidUploadedObject } from "@/lib/r2-upload";
import { createClient } from "@/lib/supabase/server";
import { isUploadKey, type UploadTarget } from "@/lib/uploads";
import {
  bannerSchema,
  categorySchema,
  collectionProductsSchema,
  collectionSchema,
  idSchema,
  productSearchSchema,
  sizeChartSchema,
  tagSchema,
} from "@/lib/validators/admin-catalog";

// Category, collection, tag, size chart and banner admin (owner and staff). Writes run as the
// signed-in admin, so the catalog RLS policies apply too. Rows that are still referenced can't be
// deleted (foreign keys restrict it); the admin deactivates them instead.

// Category slugs double as collection URLs (/collections/[slug]), so both share the collection tag.
function revalidateCatalog(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs)) if (slug) revalidateTag(cacheTags.collection(slug), "max");
  revalidateTag(cacheTags.catalog, "max");
}

// An image key is accepted if it is unchanged, cleared, or a fresh upload this app generated.
async function acceptImage(key: string | null, target: UploadTarget, current: string | null): Promise<boolean> {
  if (key === null || key === current) return true;
  return isUploadKey(key, target) && (await isValidUploadedObject(key));
}

const UPLOAD_FAILED = "The image upload didn't finish. Please upload it again.";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategory(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...c } = parsed.data;
  if (id && c.parentId === id) return { ok: false, error: "A category can't sit inside itself." };

  const supabase = await createClient();
  const current = id
    ? (await supabase.from("categories").select("slug, image_key").eq("id", id).maybeSingle()).data
    : null;
  if (id && !current) return { ok: false, error: "This category no longer exists." };
  if (!(await acceptImage(c.imageKey, "category", current?.image_key ?? null))) return { ok: false, error: UPLOAD_FAILED };

  const row = {
    name: c.name,
    slug: c.slug,
    parent_id: c.parentId,
    image_key: c.imageKey,
    sort_order: c.sortOrder,
    is_active: c.isActive,
  };
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog(current?.slug, c.slug);
  refresh();
  return { ok: true, message: id ? "Category saved" : "Category added" };
}

export async function deleteCategory(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Category not found" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", parsed.data).select("slug").maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog(data?.slug);
  refresh();
  return { ok: true, message: "Category deleted" };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export async function saveCollection(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...c } = parsed.data;

  const supabase = await createClient();
  const current = id
    ? (await supabase.from("collections").select("slug, image_key").eq("id", id).maybeSingle()).data
    : null;
  if (id && !current) return { ok: false, error: "This collection no longer exists." };
  if (!(await acceptImage(c.imageKey, "collection", current?.image_key ?? null))) {
    return { ok: false, error: UPLOAD_FAILED };
  }

  const row = { title: c.title, slug: c.slug, description: c.description, image_key: c.imageKey, is_active: c.isActive };
  if (id) {
    const { error } = await supabase.from("collections").update(row).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateCatalog(current?.slug, c.slug);
    refresh();
    return { ok: true, message: "Collection saved" };
  }

  const { data, error } = await supabase.from("collections").insert(row).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog(c.slug);
  redirect(`/admin/catalog/collections/${data.id}`);
}

export async function deleteCollection(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Collection not found" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("collections").delete().eq("id", parsed.data).select("slug").maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog(data?.slug);
  redirect("/admin/catalog/collections");
}

export async function setCollectionProducts(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = collectionProductsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: collection } = await supabase
    .from("collections")
    .select("slug")
    .eq("id", parsed.data.collectionId)
    .maybeSingle();
  if (!collection) return { ok: false, error: "This collection no longer exists." };
  const { error } = await supabase.rpc("admin_set_collection_products", {
    p_collection_id: parsed.data.collectionId,
    p_product_ids: parsed.data.productIds,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog(collection.slug);
  refresh();
  return { ok: true, message: "Collection products saved" };
}

export async function searchProducts(q: unknown): Promise<AdminProductSummary[]> {
  await requireAdmin();
  const parsed = productSearchSchema.safeParse(q);
  return parsed.success ? searchAdminProducts(parsed.data) : [];
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export async function saveTag(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, name, slug } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("tags").update({ name, slug }).eq("id", id)
    : await supabase.from("tags").insert({ name, slug });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog();
  refresh();
  return { ok: true, message: id ? "Tag saved" : "Tag added" };
}

export async function deleteTag(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Tag not found" };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", parsed.data);
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "This tag is still on some products. Remove it from them first." : dbErrorMessage(error),
    };
  }
  revalidateCatalog();
  refresh();
  return { ok: true, message: "Tag deleted" };
}

// ---------------------------------------------------------------------------
// Size charts
// ---------------------------------------------------------------------------
export async function saveSizeChart(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = sizeChartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, name, unit, columns, rows, note } = parsed.data;
  const data = { unit, columns, rows, ...(note ? { note } : {}) };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("size_charts").update({ name, data }).eq("id", id)
    : await supabase.from("size_charts").insert({ name, data });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog();
  refresh();
  return { ok: true, message: id ? "Size chart saved" : "Size chart added" };
}

export async function deleteSizeChart(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Size chart not found" };

  const supabase = await createClient();
  const { error } = await supabase.from("size_charts").delete().eq("id", parsed.data);
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "Some products still use this size chart. Switch them to another first." : dbErrorMessage(error),
    };
  }
  revalidateCatalog();
  refresh();
  return { ok: true, message: "Size chart deleted" };
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------
export async function saveBanner(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...b } = parsed.data;

  const supabase = await createClient();
  const current = id ? (await supabase.from("banners").select("image_key").eq("id", id).maybeSingle()).data : null;
  if (id && !current) return { ok: false, error: "This banner no longer exists." };
  if (!(await acceptImage(b.imageKey, "banner", current?.image_key ?? null))) return { ok: false, error: UPLOAD_FAILED };

  const row = {
    title: b.title,
    image_key: b.imageKey,
    link: b.link,
    sort_order: b.sortOrder,
    starts_at: b.startsAt,
    ends_at: b.endsAt,
    is_active: b.isActive,
  };
  const { error } = id
    ? await supabase.from("banners").update(row).eq("id", id)
    : await supabase.from("banners").insert(row);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  // TODO(owner): scheduled banners appear or disappear when the home page cache next refreshes
  // (hours), not at the exact start/end minute.
  revalidateCatalog();
  refresh();
  return { ok: true, message: id ? "Banner saved" : "Banner added" };
}

export async function deleteBanner(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Banner not found" };

  const supabase = await createClient();
  const { error } = await supabase.from("banners").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateCatalog();
  refresh();
  return { ok: true, message: "Banner deleted" };
}
