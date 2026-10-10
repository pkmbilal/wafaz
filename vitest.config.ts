import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    environment: "node",
    // Cold imports of the PDF renderer and UI modules can pass the 5s/10s defaults on a first run.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // DB tests share one local Supabase stack; run files one at a time.
    fileParallelism: false,
  },
});
