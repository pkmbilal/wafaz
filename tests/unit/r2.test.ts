import { beforeAll, describe, expect, it, vi } from "vitest";

let mediaUrl: typeof import("@/lib/r2").mediaUrl;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "");
  ({ mediaUrl } = await import("@/lib/r2"));
});

describe("mediaUrl", () => {
  it("serves seed keys from public/", () => {
    expect(mediaUrl("seed/placeholder-01.webp")).toBe("/seed/placeholder-01.webp");
    expect(mediaUrl("/seed/banner-01.webp")).toBe("/seed/banner-01.webp");
  });

  it("joins other keys onto the media base URL", () => {
    expect(mediaUrl("products/abc/1.webp", "https://media.example.com/")).toBe(
      "https://media.example.com/products/abc/1.webp",
    );
  });

  it("throws when the media base URL is missing for non-seed keys", () => {
    expect(() => mediaUrl("products/abc/1.webp")).toThrow(/NEXT_PUBLIC_MEDIA_URL/);
  });
});
