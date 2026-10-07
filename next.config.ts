import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Catalog pages use "use cache" + cacheTag; session-bearing routes read cookies and stay dynamic.
  cacheComponents: true,
};

export default nextConfig;
