import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Catalog pages use "use cache" + cacheTag; session-bearing routes read cookies and stay dynamic.
  cacheComponents: true,
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    // Fixed widths to keep the Cloudflare transformation count predictable (AGENTS.md §5.9).
    deviceSizes: [320, 480, 768, 1080, 1440],
    imageSizes: [],
    qualities: [75],
  },
};

export default nextConfig;
