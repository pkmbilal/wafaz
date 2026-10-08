// Admin image upload rules (AGENTS.md §5.8/§5.9), shared by the uploader UI, the presign route and
// the Server Actions that save an uploaded key. Keys are always generated on the server.

export const UPLOAD_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type UploadContentType = keyof typeof UPLOAD_CONTENT_TYPES;

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_CONTENT_TYPES).join(",");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_TARGETS = ["product", "category", "collection", "banner"] as const;
export type UploadTarget = (typeof UPLOAD_TARGETS)[number];

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXT = `(?:${Object.values(UPLOAD_CONTENT_TYPES).join("|")})`;

function prefixFor(target: UploadTarget, productId?: string): string {
  switch (target) {
    case "product":
      if (!productId) throw new Error("productId is required for product uploads");
      return `products/${productId}/`;
    case "category":
      return "categories/";
    case "collection":
      return "collections/";
    case "banner":
      return "banners/";
  }
}

export function isUploadContentType(value: string): value is UploadContentType {
  return Object.hasOwn(UPLOAD_CONTENT_TYPES, value);
}

// e.g. products/{product_id}/{uuid}.webp
export function buildUploadKey(
  target: UploadTarget,
  contentType: UploadContentType,
  fileId: string,
  productId?: string,
): string {
  return `${prefixFor(target, productId)}${fileId}.${UPLOAD_CONTENT_TYPES[contentType]}`;
}

// True only for keys this app could have generated for that target (and product).
export function isUploadKey(key: string, target: UploadTarget, productId?: string): boolean {
  if (target === "product" && !productId) return false;
  const prefix = prefixFor(target, productId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${prefix}${UUID}\\.${EXT}$`).test(key);
}
