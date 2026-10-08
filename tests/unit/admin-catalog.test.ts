import { describe, expect, it } from "vitest";
import { dbErrorMessage } from "@/lib/admin-actions";
import {
  buildSku,
  buildVariantMatrix,
  isoToIstLocal,
  istLocalToIso,
  paiseToRupeesInput,
  rupeesToPaise,
  skuPrefixFromSlug,
  slugify,
} from "@/lib/catalog/admin-input";
import { buildUploadKey, isUploadContentType, isUploadKey } from "@/lib/uploads";
import {
  bannerSchema,
  presignRequestSchema,
  productDetailsSchema,
  saveVariantsSchema,
  sizeChartSchema,
  variantRowSchema,
} from "@/lib/validators/admin-catalog";

const PRODUCT_ID = "3f0c6a2e-8d4b-4c1a-9e57-1b2c3d4e5f60";
const FILE_ID = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

describe("rupee input", () => {
  it.each([
    ["899", 89900],
    ["1,299.50", 129950],
    ["₹ 1299.5", 129950],
    ["0.05", 5],
    ["12345678", 1234567800],
  ])("parses %s", (input, paise) => {
    expect(rupeesToPaise(input)).toBe(paise);
  });

  it.each(["", "abc", "12.345", "-5", "1e3", "123456789"])("rejects %j", (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });

  it("round-trips paise", () => {
    expect(paiseToRupeesInput(89900)).toBe("899");
    expect(paiseToRupeesInput(129950)).toBe("1299.50");
    expect(paiseToRupeesInput(5)).toBe("0.05");
    expect(rupeesToPaise(paiseToRupeesInput(123407))).toBe(123407);
  });
});

describe("slugs and SKUs", () => {
  it("slugifies titles", () => {
    expect(slugify("Maroon Anarkali Kurti")).toBe("maroon-anarkali-kurti");
    expect(slugify("  Co-ords & Sets!! ")).toBe("co-ords-and-sets");
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("a".repeat(100))).toHaveLength(80);
    expect(slugify("---")).toBe("");
  });

  it("builds SKUs that match the DB pattern", () => {
    expect(skuPrefixFromSlug("indigo-block-print-kurti")).toBe("IBPK");
    expect(skuPrefixFromSlug("")).toBe("SKU");
    const generated = buildSku("IBPK", "Off White", "Free Size");
    expect(generated).toBe("IBPK-OFFWHITE-FREESIZE");
    expect(generated).toMatch(/^[A-Z0-9][A-Z0-9-]{0,39}$/);
    expect(buildSku("A".repeat(20), "B".repeat(20), "C".repeat(20)).length).toBeLessThanOrEqual(40);
  });
});

describe("buildVariantMatrix", () => {
  const base = {
    skuPrefix: "MAK",
    mrpPaise: 349900,
    pricePaise: 249900,
    weightGrams: 420,
    stock: 3,
  };

  it("creates every size × colour, sizes in display order", () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ["XL", "S", "M"],
      colours: [
        { name: "Maroon", hex: "#7B1E2B" },
        { name: "Emerald", hex: "#1E6B4F" },
      ],
    });
    expect(rows.map((r) => `${r.colour}/${r.size}`)).toEqual([
      "Maroon/S",
      "Maroon/M",
      "Maroon/XL",
      "Emerald/S",
      "Emerald/M",
      "Emerald/XL",
    ]);
    expect(rows[0]).toMatchObject({ sku: "MAK-MAROON-S", colourHex: "#7B1E2B", pricePaise: 249900, stock: 3 });
  });

  it("skips existing combinations, blanks and duplicates (case-insensitive)", () => {
    const rows = buildVariantMatrix(
      {
        ...base,
        sizes: ["S", " S ", "", "M"],
        colours: [
          { name: "Maroon", hex: "" },
          { name: "maroon", hex: "" },
          { name: " ", hex: "" },
        ],
      },
      [{ size: "s", colour: "MAROON" }],
    );
    expect(rows.map((r) => `${r.colour}/${r.size}`)).toEqual(["Maroon/M"]);
  });
});

describe("IST date inputs", () => {
  it("treats datetime-local values as Kerala time", () => {
    expect(istLocalToIso("2026-10-10T09:00")).toBe("2026-10-10T03:30:00.000Z");
    expect(isoToIstLocal("2026-10-10T03:30:00.000Z")).toBe("2026-10-10T09:00");
    expect(isoToIstLocal("2026-12-31T20:00:00Z")).toBe("2027-01-01T01:30");
    expect(isoToIstLocal(null)).toBe("");
  });

  it("rejects malformed values", () => {
    expect(istLocalToIso("2026-10-10")).toBeNull();
    expect(istLocalToIso("2026-13-40T99:00")).toBeNull();
  });
});

describe("upload keys", () => {
  it("builds keys per target", () => {
    expect(buildUploadKey("product", "image/webp", FILE_ID, PRODUCT_ID)).toBe(`products/${PRODUCT_ID}/${FILE_ID}.webp`);
    expect(buildUploadKey("banner", "image/jpeg", FILE_ID)).toBe(`banners/${FILE_ID}.jpg`);
    expect(() => buildUploadKey("product", "image/png", FILE_ID)).toThrow();
  });

  it("accepts only keys the server could have generated for that target", () => {
    const key = `products/${PRODUCT_ID}/${FILE_ID}.webp`;
    expect(isUploadKey(key, "product", PRODUCT_ID)).toBe(true);
    expect(isUploadKey(key, "product", FILE_ID)).toBe(false);
    expect(isUploadKey(key, "product")).toBe(false);
    expect(isUploadKey(`categories/${FILE_ID}.png`, "category")).toBe(true);
    expect(isUploadKey(`categories/${FILE_ID}.png`, "banner")).toBe(false);
    expect(isUploadKey(`categories/${FILE_ID}.gif`, "category")).toBe(false);
    expect(isUploadKey(`categories/../${FILE_ID}.png`, "category")).toBe(false);
    expect(isUploadKey("seed/banner-01.webp", "banner")).toBe(false);
  });

  it("limits content types", () => {
    expect(isUploadContentType("image/avif")).toBe(true);
    expect(isUploadContentType("image/svg+xml")).toBe(false);
    expect(isUploadContentType("toString")).toBe(false);
  });

  it("validates presign requests", () => {
    const ok = presignRequestSchema.safeParse({ target: "product", productId: PRODUCT_ID, contentType: "image/png", size: 1000 });
    expect(ok.success).toBe(true);
    expect(presignRequestSchema.safeParse({ target: "product", contentType: "image/png", size: 1000 }).success).toBe(false);
    expect(presignRequestSchema.safeParse({ target: "banner", contentType: "image/gif", size: 1000 }).success).toBe(false);
    expect(presignRequestSchema.safeParse({ target: "banner", contentType: "image/png", size: 11 * 1024 * 1024 }).success).toBe(false);
  });
});

describe("product and variant validation", () => {
  it("normalises empty optional fields to null", () => {
    const parsed = productDetailsSchema.parse({
      title: " Kurti ",
      slug: "kurti",
      categoryId: PRODUCT_ID,
      hsnCode: "6211",
      description: "",
      fabric: "Cotton",
      style: "",
      occasion: "",
      care: "",
      countryOfOrigin: "India",
      sizeChartId: "",
      status: "draft",
      seoTitle: "",
      seoDescription: "",
    });
    expect(parsed).toMatchObject({ title: "Kurti", description: null, fabric: "Cotton", sizeChartId: null });
  });

  const row = {
    sku: "mak-maroon-s",
    size: "S",
    colour: "Maroon",
    colourHex: "#7b1e2b",
    mrp: "3,499",
    price: "2499.50",
    weightGrams: "420",
    stock: "5",
    isActive: true,
  };

  it("converts rupees to paise and uppercases SKUs and hex", () => {
    expect(variantRowSchema.parse(row)).toMatchObject({
      sku: "MAK-MAROON-S",
      colourHex: "#7B1E2B",
      mrp: 349900,
      price: 249950,
      weightGrams: 420,
      stock: 5,
    });
  });

  it("rejects a price above the MRP and bad numbers", () => {
    expect(variantRowSchema.safeParse({ ...row, price: "3500" }).success).toBe(false);
    expect(variantRowSchema.safeParse({ ...row, mrp: "0" }).success).toBe(false);
    expect(variantRowSchema.safeParse({ ...row, weightGrams: "2.5" }).success).toBe(false);
    expect(variantRowSchema.safeParse({ ...row, colourHex: "maroon" }).success).toBe(false);
  });

  it("rejects duplicate SKUs and size/colour pairs in one save", () => {
    const dupSku = saveVariantsSchema.safeParse({ productId: PRODUCT_ID, variants: [row, { ...row, size: "M" }] });
    expect(dupSku.success).toBe(false);
    const dupCombo = saveVariantsSchema.safeParse({
      productId: PRODUCT_ID,
      variants: [row, { ...row, sku: "OTHER", colour: "maroon" }],
    });
    expect(dupCombo.success).toBe(false);
  });
});

describe("size charts and banners", () => {
  const chart = {
    name: "Women's standard",
    unit: "in",
    columns: ["Size", "Bust"],
    rows: [
      ["S", "34"],
      ["M", "36.5"],
    ],
    note: "",
  };

  it("stores numeric cells as numbers", () => {
    expect(sizeChartSchema.parse(chart).rows).toEqual([
      ["S", 34],
      ["M", 36.5],
    ]);
  });

  it("requires every row to match the columns and have a size", () => {
    expect(sizeChartSchema.safeParse({ ...chart, rows: [["S"]] }).success).toBe(false);
    expect(sizeChartSchema.safeParse({ ...chart, rows: [["", "34"]] }).success).toBe(false);
  });

  const banner = {
    title: "Onam edit",
    imageKey: `banners/${FILE_ID}.webp`,
    link: "/collections/onam",
    sortOrder: "1",
    startsAt: "2026-10-01T00:00",
    endsAt: "2026-10-10T00:00",
    isActive: true,
  };

  it("accepts internal links only", () => {
    expect(bannerSchema.safeParse(banner).success).toBe(true);
    expect(bannerSchema.safeParse({ ...banner, link: "" }).success).toBe(true);
    for (const link of ["https://evil.example", "//evil.example", "/\\evil", "collections/x", "/a b"]) {
      expect(bannerSchema.safeParse({ ...banner, link }).success, link).toBe(false);
    }
  });

  it("needs the end after the start", () => {
    expect(bannerSchema.safeParse({ ...banner, endsAt: "2026-09-30T23:00" }).success).toBe(false);
    expect(bannerSchema.parse({ ...banner, endsAt: "" }).endsAt).toBeNull();
  });
});

describe("dbErrorMessage", () => {
  it("maps known constraints", () => {
    expect(
      dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "product_variants_sku_key"' }),
    ).toMatch(/SKU/);
    expect(dbErrorMessage({ code: "23503", message: "fk" })).toMatch(/still in use/);
    expect(dbErrorMessage({ code: "23514", message: "stock:below_reserved" })).toMatch(/reserved/);
    expect(dbErrorMessage({ code: "XX000", message: "boom" }, "Fallback")).toBe("Fallback");
  });
});
