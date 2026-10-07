import { describe, expect, it } from "vitest";
import imageLoader from "@/lib/image-loader";

describe("imageLoader", () => {
  it("keeps local files local", () => {
    expect(imageLoader({ src: "/seed/placeholder-01.webp", width: 480 })).toBe(
      "/seed/placeholder-01.webp?w=480",
    );
  });

  it("builds Cloudflare Image Resizing URLs for remote media", () => {
    expect(
      imageLoader({ src: "https://media.example.com/products/abc/1.webp", width: 768, quality: 75 }),
    ).toBe(
      "https://media.example.com/cdn-cgi/image/width=768,quality=75,format=auto,fit=scale-down/products/abc/1.webp",
    );
  });
});
