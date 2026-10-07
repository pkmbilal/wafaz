import { describe, expect, it } from "vitest";
import { listingSearchParams, parseListingFilters } from "@/lib/validators/catalog";
import { discountPercent, formatInr } from "@/lib/format";
import { compareSizes } from "@/lib/catalog/sizes";

describe("parseListingFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseListingFilters({})).toEqual({
      query: null,
      sizes: [],
      colours: [],
      fabrics: [],
      minPaise: null,
      maxPaise: null,
      sort: "featured",
      page: 1,
    });
  });

  it("parses repeated and comma-separated values and converts rupees to paise", () => {
    const f = parseListingFilters({
      size: ["M", "L,XL"],
      colour: "Black",
      fabric: "Cotton",
      min: "500",
      max: "1500",
      sort: "price_asc",
      page: "3",
      q: "  kurti ",
    });
    expect(f.sizes).toEqual(["M", "L", "XL"]);
    expect(f.colours).toEqual(["Black"]);
    expect(f.minPaise).toBe(50_000);
    expect(f.maxPaise).toBe(150_000);
    expect(f.sort).toBe("price_asc");
    expect(f.page).toBe(3);
    expect(f.query).toBe("kurti");
  });

  it("drops invalid values instead of failing", () => {
    const f = parseListingFilters({ sort: "cheapest", page: "-2", min: "abc" });
    expect(f.sort).toBe("featured");
    expect(f.page).toBe(1);
    expect(f.minPaise).toBeNull();
  });

  it("round-trips through listingSearchParams without defaults", () => {
    const params = listingSearchParams({ sizes: ["M"], sort: "featured", page: 1, minPaise: 50_000 });
    expect(params.toString()).toBe("size=M&min=500");
  });
});

describe("formatInr / discountPercent", () => {
  it("formats whole rupees without decimals and paise with two", () => {
    expect(formatInr(129_900)).toBe("₹1,299");
    expect(formatInr(12_345_650)).toBe("₹1,23,456.50");
  });

  it("rejects non-integer paise", () => {
    expect(() => formatInr(10.5)).toThrow();
  });

  it("rounds the discount down and never goes negative", () => {
    expect(discountPercent(129_900, 89_900)).toBe(30);
    expect(discountPercent(100_000, 100_000)).toBe(0);
    expect(discountPercent(100_000, 120_000)).toBe(0);
  });
});

describe("compareSizes", () => {
  it("orders standard sizes, then others alphabetically", () => {
    expect(["XL", "Free Size", "S", "28", "M", "XS"].sort(compareSizes)).toEqual([
      "XS",
      "S",
      "M",
      "XL",
      "Free Size",
      "28",
    ]);
  });
});

describe("pageWindow", () => {
  it("shows first, last and neighbours with gaps", async () => {
    const { pageWindow } = await import("@/components/store/listing-pagination");
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(10, 10)).toEqual([1, "gap", 9, 10]);
  });
});
