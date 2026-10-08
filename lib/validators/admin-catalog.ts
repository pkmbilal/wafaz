import { z } from "zod";
import { istLocalToIso, rupeesToPaise, SLUG_PATTERN } from "@/lib/catalog/admin-input";
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES, type UploadContentType } from "@/lib/uploads";

// Inputs for the admin catalog screens (app/admin/(protected)/products and /catalog). Form schemas
// take the text the admin typed (rupees, empty strings) and output DB-ready values.

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCTS_PAGE_SIZE = 25;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

const optionalUuid = z.union([z.uuid(), z.literal("")]).transform((v) => (v === "" ? null : v));

const slug = z
  .string()
  .trim()
  .min(1, "Add a URL slug")
  .max(80, "Keep the slug under 80 characters")
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single dashes");

const rupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const paise = rupeesToPaise(v);
      if (paise === null || paise <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter the ${label} in rupees` });
        return z.NEVER;
      }
      return paise;
    });

const wholeNumber = (label: string, min: number, max: number) =>
  z.union([z.number(), z.string().trim()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : /^-?\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}` });
      return z.NEVER;
    }
    return n;
  });

// Internal storefront paths only (banners.link check).
const internalLink = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || (/^\/[^/\\]/.test(v) && !/\s/.test(v)) || v === "/", "Use a store path such as /collections/new-arrivals")
  .transform((v) => (v === "" ? null : v));

const istDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const iso = istLocalToIso(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return iso;
  });

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
const contentType = z
  .string()
  .refine((v): v is UploadContentType => Object.hasOwn(UPLOAD_CONTENT_TYPES, v), "Use a JPEG, PNG, WebP or AVIF image")
  .transform((v) => v as UploadContentType);
const size = z.number().int().min(1).max(MAX_UPLOAD_BYTES, "Images must be 10 MB or smaller");

export const presignRequestSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("product"), productId: z.uuid(), contentType, size }),
  z.object({ target: z.literal("category"), contentType, size }),
  z.object({ target: z.literal("collection"), contentType, size }),
  z.object({ target: z.literal("banner"), contentType, size }),
]);

// An image key on a category, collection or banner form: "" (none) or a key the server checks.
const imageKey = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? null : v));

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const productListFiltersSchema = z.object({
  // Title or SKU. Restricted to characters that are safe inside a PostgREST filter.
  q: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z0-9 -]*$/)
    .optional()
    .catch(undefined),
  status: z.enum(PRODUCT_STATUSES).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type ProductListFilters = z.infer<typeof productListFiltersSchema>;

export const productDetailsSchema = z.object({
  title: z.string().trim().min(1, "Add a title").max(200, "Keep the title under 200 characters"),
  slug,
  categoryId: z.uuid("Choose a category"),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN codes are 4 to 8 digits"),
  description: optionalText(5000),
  fabric: optionalText(60),
  style: optionalText(60),
  occasion: optionalText(60),
  care: optionalText(1000),
  countryOfOrigin: z.string().trim().min(2, "Add the country of origin").max(60),
  sizeChartId: optionalUuid,
  status: z.enum(PRODUCT_STATUSES),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
});
export type ProductDetailsInput = z.input<typeof productDetailsSchema>;
export type ProductDetails = z.output<typeof productDetailsSchema>;

export const EMPTY_PRODUCT: ProductDetailsInput = {
  title: "",
  slug: "",
  categoryId: "",
  hsnCode: "",
  description: "",
  fabric: "",
  style: "",
  occasion: "",
  care: "",
  countryOfOrigin: "India",
  sizeChartId: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
};

export const updateProductSchema = productDetailsSchema.extend({ id: z.uuid() });

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,39}$/;

export const variantRowSchema = z
  .object({
    id: z.uuid().optional(),
    sku: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(SKU_PATTERN, "SKUs use capital letters, digits and dashes (max 40)")),
    size: z.string().trim().min(1, "Add a size").max(20),
    colour: z.string().trim().min(1, "Add a colour").max(40),
    colourHex: z
      .string()
      .trim()
      .refine((v) => v === "" || /^#[0-9A-Fa-f]{6}$/.test(v), "Use a colour like #7B1E2B")
      .transform((v) => (v === "" ? null : v.toUpperCase())),
    mrp: rupees("MRP"),
    price: rupees("selling price"),
    weightGrams: wholeNumber("Weight (g)", 1, 50000),
    // Opening stock for new variants only; existing stock changes through adjustStockSchema.
    stock: wholeNumber("Stock", 0, 100000).optional(),
    isActive: z.boolean(),
  })
  .refine((v) => v.price <= v.mrp, { message: "Selling price can't be above the MRP", path: ["price"] });

export type VariantRowInput = z.input<typeof variantRowSchema>;
export type VariantRow = z.output<typeof variantRowSchema>;

export const saveVariantsSchema = z
  .object({ productId: z.uuid(), variants: z.array(variantRowSchema).max(200) })
  .superRefine(({ variants }, ctx) => {
    const skus = new Set<string>();
    const combos = new Set<string>();
    variants.forEach((v, i) => {
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", message: `SKU ${v.sku} is used twice`, path: ["variants", i, "sku"] });
      skus.add(v.sku);
      const combo = `${v.size.toLowerCase()}|${v.colour.toLowerCase()}`;
      if (combos.has(combo)) {
        ctx.addIssue({ code: "custom", message: `${v.colour} / ${v.size} is listed twice`, path: ["variants", i, "size"] });
      }
      combos.add(combo);
    });
  });

export const adjustStockSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  delta: wholeNumber("Change", -100000, 100000).refine((v) => v !== 0, "Enter how many units to add or remove"),
});

// ---------------------------------------------------------------------------
// Product media, tags and collections
// ---------------------------------------------------------------------------
const mediaColour = z
  .string()
  .trim()
  .max(40)
  .transform((v) => (v === "" ? null : v));
const alt = optionalText(200);

export const addMediaSchema = z.object({ productId: z.uuid(), key: z.string().max(200), colour: mediaColour, alt });
export const updateMediaSchema = z.object({ productId: z.uuid(), mediaId: z.uuid(), colour: mediaColour, alt });
export const deleteMediaSchema = z.object({ productId: z.uuid(), mediaId: z.uuid() });
export const reorderMediaSchema = z.object({ productId: z.uuid(), mediaIds: z.array(z.uuid()).min(1).max(100) });

export const productTagsSchema = z.object({ productId: z.uuid(), tagIds: z.array(z.uuid()).max(50) });
export const productCollectionsSchema = z.object({ productId: z.uuid(), collectionIds: z.array(z.uuid()).max(50) });

// ---------------------------------------------------------------------------
// Categories, collections, tags, size charts, banners
// ---------------------------------------------------------------------------
export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Add a name").max(80),
  slug,
  parentId: optionalUuid,
  imageKey,
  sortOrder: wholeNumber("Sort order", -1000, 1000),
  isActive: z.boolean(),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const collectionSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Add a title").max(120),
  slug,
  description: optionalText(1000),
  imageKey,
  isActive: z.boolean(),
});
export type CollectionInput = z.input<typeof collectionSchema>;

export const collectionProductsSchema = z.object({
  collectionId: z.uuid(),
  productIds: z.array(z.uuid()).max(500),
});

export const productSearchSchema = z.string().trim().min(2).max(80);

export const tagSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Add a name").max(40),
  slug,
});
export type TagInput = z.input<typeof tagSchema>;

const sizeChartCell = z
  .string()
  .trim()
  .max(20, "Keep cells under 20 characters")
  .transform((v) => (/^\d+(\.\d+)?$/.test(v) ? Number(v) : v));

export const sizeChartSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Add a name").max(80),
    unit: z.enum(["in", "cm"]),
    columns: z.array(z.string().trim().min(1, "Name every column").max(30)).min(2, "Add at least two columns").max(10),
    rows: z.array(z.array(sizeChartCell)).min(1, "Add at least one row").max(30),
    note: optionalText(300),
  })
  .superRefine((v, ctx) => {
    v.rows.forEach((row, i) => {
      if (row.length !== v.columns.length) {
        ctx.addIssue({ code: "custom", message: "Every row needs a value for each column", path: ["rows", i] });
      } else if (row[0] === "") {
        ctx.addIssue({ code: "custom", message: "Every row needs a size", path: ["rows", i] });
      }
    });
  });
export type SizeChartInput = z.input<typeof sizeChartSchema>;

export const bannerSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Add a title").max(120),
    imageKey: z.string().trim().min(1, "Upload a banner image").max(200),
    link: internalLink,
    sortOrder: wholeNumber("Sort order", -1000, 1000),
    startsAt: istDateTime,
    endsAt: istDateTime,
    isActive: z.boolean(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: "The end must be after the start",
    path: ["endsAt"],
  });
export type BannerInput = z.input<typeof bannerSchema>;

export const idSchema = z.uuid();
