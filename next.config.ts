import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Catalog pages use "use cache" + cacheTag; session-bearing routes read cookies and stay dynamic.
  cacheComponents: true,
  // PDFs register their fonts from disk at runtime, so the TTFs must ship with the routes that render them.
  outputFileTracingIncludes: {
    "/api/invoices/*": ["./pdf/fonts/**/*"],
    "/api/credit-notes/*": ["./pdf/fonts/**/*"],
    "/admin/orders/*": ["./pdf/fonts/**/*"],
  },
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    // Fixed widths to keep the Cloudflare transformation count predictable (AGENTS.md §5.9).
    deviceSizes: [320, 480, 768, 1080, 1440],
    imageSizes: [],
    qualities: [75],
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set (Vercel build env).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Same-origin tunnel so ad-blockers don't drop browser error reports.
  tunnelRoute: "/monitoring",
});
