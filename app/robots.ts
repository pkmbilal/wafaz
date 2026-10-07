import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/checkout", "/orders", "/cart", "/login", "/api"],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
