import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getSitemapEntries } from "@/lib/catalog/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const entries = await getSitemapEntries();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...entries.map((e) => ({
      url: `${base}${e.path}`,
      lastModified: e.updatedAt,
      changeFrequency: e.path.startsWith("/pages/") ? ("monthly" as const) : ("weekly" as const),
      priority: e.path.startsWith("/products/") ? 0.8 : 0.6,
    })),
  ];
}
