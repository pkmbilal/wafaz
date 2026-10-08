import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createCustomer, deleteUsers, type TestClient } from "./helpers";

// M9 admin catalog helpers: role checks, column grants, stock adjustments and the set/reorder
// functions behind the product and collection screens.

const admin = adminClient();
const users: string[] = [];
let staff: TestClient;
let customer: TestClient;
let categoryId: string;
let productId: string;
const collectionIds: string[] = [];
const tagIds: string[] = [];

const suffix = randomUUID().slice(0, 8);
const sku = (s: string) => `T${suffix.toUpperCase()}-${s}`;

function variant(size: string, colour: string, extra: Record<string, unknown> = {}) {
  return {
    sku: sku(`${colour}-${size}`.toUpperCase()),
    size,
    colour,
    colour_hex: "#7B1E2B",
    mrp_paise: 149900,
    price_paise: 99900,
    weight_grams: 250,
    is_active: true,
    ...extra,
  };
}

async function variantsOf(id: string) {
  const { data, error } = await admin
    .from("product_variants")
    .select("id, sku, size, colour, stock, reserved, price_paise")
    .eq("product_id", id)
    .order("sku");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  const s = await createCustomer();
  const c = await createCustomer();
  users.push(s.id, c.id);
  staff = s.client;
  customer = c.client;
  const { error } = await admin.from("profiles").update({ role: "staff" }).eq("id", s.id);
  if (error) throw error;

  const { data: category } = await admin.from("categories").select("id").limit(1).single();
  categoryId = category!.id;

  const { data: product, error: productError } = await staff
    .from("products")
    .insert({ category_id: categoryId, title: `Test kurti ${suffix}`, slug: `test-kurti-${suffix}`, hsn_code: "6211" })
    .select("id")
    .single();
  if (productError) throw productError;
  productId = product.id;

  for (const n of [1, 2]) {
    const { data } = await admin
      .from("collections")
      .insert({ title: `Test ${n} ${suffix}`, slug: `test-${n}-${suffix}` })
      .select("id")
      .single();
    collectionIds.push(data!.id);
    const { data: tag } = await admin
      .from("tags")
      .insert({ name: `zzqtag${n}${suffix}`, slug: `zzqtag${n}-${suffix}` })
      .select("id")
      .single();
    tagIds.push(tag!.id);
  }
});

afterAll(async () => {
  await admin.from("collection_products").delete().eq("product_id", productId);
  await admin.from("product_media").delete().eq("product_id", productId);
  await admin.from("product_variants").delete().eq("product_id", productId);
  await admin.from("products").delete().eq("id", productId);
  await admin.from("collections").delete().in("id", collectionIds);
  await admin.from("tags").delete().in("id", tagIds);
  await deleteUsers(...users);
});

describe("catalog writes", () => {
  it("lets staff create products but not customers", async () => {
    const { error } = await customer
      .from("products")
      .insert({ category_id: categoryId, title: "Nope", slug: `nope-${suffix}`, hsn_code: "6211" });
    expect(error).not.toBeNull();
  });

  it("never lets admins write stock directly", async () => {
    await staff.rpc("admin_save_variants", { p_product_id: productId, p_variants: [variant("S", "Maroon", { stock: 5 })] });
    const [v] = await variantsOf(productId);
    const { error } = await staff.from("product_variants").update({ stock: 99 }).eq("id", v.id);
    expect(error?.code).toBe("42501");
  });
});

describe("admin_save_variants", () => {
  it("inserts new variants with opening stock and updates existing ones without touching stock", async () => {
    const before = await variantsOf(productId);
    const existing = before.find((v) => v.size === "S")!;
    const { error } = await staff.rpc("admin_save_variants", {
      p_product_id: productId,
      p_variants: [
        { ...variant("S", "Maroon", { price_paise: 89900, stock: 500 }), id: existing.id },
        variant("M", "Maroon", { stock: 7 }),
      ],
    });
    expect(error).toBeNull();

    const after = await variantsOf(productId);
    const s = after.find((v) => v.size === "S")!;
    const m = after.find((v) => v.size === "M")!;
    expect(s.price_paise).toBe(89900);
    expect(s.stock).toBe(existing.stock);
    expect(m.stock).toBe(7);
  });

  it("is all-or-nothing", async () => {
    const before = await variantsOf(productId);
    const { error } = await staff.rpc("admin_save_variants", {
      p_product_id: productId,
      p_variants: [variant("L", "Maroon"), variant("M", "Maroon")], // M already exists
    });
    expect(error?.code).toBe("23505");
    expect(await variantsOf(productId)).toHaveLength(before.length);
  });

  it("rejects a variant id from another product", async () => {
    const { data: other } = await admin
      .from("product_variants")
      .select("id")
      .neq("product_id", productId)
      .limit(1)
      .single();
    const { error } = await staff.rpc("admin_save_variants", {
      p_product_id: productId,
      p_variants: [{ ...variant("XL", "Maroon"), id: other!.id }],
    });
    expect(error?.message).toContain("variant:not_found");
  });

  it("refuses customers", async () => {
    const { error } = await customer.rpc("admin_save_variants", {
      p_product_id: productId,
      p_variants: [variant("XS", "Maroon")],
    });
    expect(error?.message).toContain("admin:forbidden");
  });
});

describe("admin_adjust_stock", () => {
  it("adds and removes units", async () => {
    const [v] = await variantsOf(productId);
    const { data, error } = await staff.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: 10 });
    expect(error).toBeNull();
    expect(data).toBe(v.stock + 10);
    const { data: down } = await staff.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: -3 });
    expect(down).toBe(v.stock + 7);
  });

  it("never goes below the reserved units", async () => {
    const [v] = await variantsOf(productId);
    await admin.from("product_variants").update({ stock: 5, reserved: 4 }).eq("id", v.id);
    const { error } = await staff.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: -2 });
    expect(error?.message).toContain("stock:below_reserved");
    const { data } = await staff.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: -1 });
    expect(data).toBe(4);
    await admin.from("product_variants").update({ reserved: 0 }).eq("id", v.id);
  });

  it("rejects zero and customers", async () => {
    const [v] = await variantsOf(productId);
    const zero = await staff.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: 0 });
    expect(zero.error?.message).toContain("stock:invalid_delta");
    const denied = await customer.rpc("admin_adjust_stock", { p_variant_id: v.id, p_delta: 1 });
    expect(denied.error?.message).toContain("admin:forbidden");
  });
});

describe("tags, collections and ordering", () => {
  it("replaces a product's tags", async () => {
    await staff.rpc("admin_set_product_tags", { p_product_id: productId, p_tag_ids: tagIds });
    await staff.rpc("admin_set_product_tags", { p_product_id: productId, p_tag_ids: [tagIds[1]] });
    const { data } = await admin.from("product_tags").select("tag_id").eq("product_id", productId);
    expect(data?.map((t) => t.tag_id)).toEqual([tagIds[1]]);
  });

  it("refreshes the search vector when tags change", async () => {
    const { data } = await admin.from("products").select("search").eq("id", productId).single();
    expect(String(data?.search)).toContain(`zzqtag2${suffix}`);
  });

  it("adds a product to the end of each collection and removes it", async () => {
    const { data: seeded } = await admin
      .from("collection_products")
      .select("product_id")
      .eq("collection_id", collectionIds[0]);
    expect(seeded).toHaveLength(0);
    const { data: other } = await admin.from("products").select("id").neq("id", productId).limit(1).single();
    await admin.from("collection_products").insert({ collection_id: collectionIds[0], product_id: other!.id, sort_order: 4 });

    await staff.rpc("admin_set_product_collections", { p_product_id: productId, p_collection_ids: collectionIds });
    const { data: rows } = await admin
      .from("collection_products")
      .select("collection_id, sort_order")
      .eq("product_id", productId)
      .order("collection_id");
    expect(rows).toHaveLength(2);
    expect(rows?.find((r) => r.collection_id === collectionIds[0])?.sort_order).toBe(5);
    expect(rows?.find((r) => r.collection_id === collectionIds[1])?.sort_order).toBe(0);

    await staff.rpc("admin_set_product_collections", { p_product_id: productId, p_collection_ids: [collectionIds[1]] });
    const { data: left } = await admin.from("collection_products").select("collection_id").eq("product_id", productId);
    expect(left?.map((r) => r.collection_id)).toEqual([collectionIds[1]]);
    await admin.from("collection_products").delete().eq("product_id", other!.id).eq("collection_id", collectionIds[0]);
  });

  it("sets a collection's members in order", async () => {
    const { data: others } = await admin.from("products").select("id").neq("id", productId).limit(2);
    const ids = [others![1].id, productId, others![0].id];
    const { error } = await staff.rpc("admin_set_collection_products", { p_collection_id: collectionIds[0], p_product_ids: ids });
    expect(error).toBeNull();
    const { data } = await admin
      .from("collection_products")
      .select("product_id")
      .eq("collection_id", collectionIds[0])
      .order("sort_order");
    expect(data?.map((r) => r.product_id)).toEqual(ids);

    await staff.rpc("admin_set_collection_products", { p_collection_id: collectionIds[0], p_product_ids: [] });
    const { count } = await admin
      .from("collection_products")
      .select("product_id", { count: "exact", head: true })
      .eq("collection_id", collectionIds[0]);
    expect(count).toBe(0);
  });

  it("reorders product images", async () => {
    const { data: media } = await staff
      .from("product_media")
      .insert([0, 1, 2].map((n) => ({ product_id: productId, r2_key: `seed/test-${n}.webp`, sort_order: n })))
      .select("id");
    const ids = media!.map((m) => m.id).reverse();
    await staff.rpc("admin_reorder_media", { p_product_id: productId, p_media_ids: ids });
    const { data } = await admin.from("product_media").select("id").eq("product_id", productId).order("sort_order");
    expect(data?.map((m) => m.id)).toEqual(ids);
  });

  it("refuses customers", async () => {
    const { error } = await customer.rpc("admin_set_collection_products", {
      p_collection_id: collectionIds[0],
      p_product_ids: [productId],
    });
    expect(error?.message).toContain("admin:forbidden");
  });
});
