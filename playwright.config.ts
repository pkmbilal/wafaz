import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, PORT, serverEnv } from "./tests/e2e/env";

// E2E against the local Supabase stack + Razorpay test mode (AGENTS.md §8).
// Prerequisites: `supabase start`, and nothing else listening on the Send SMS Hook port
// (SUPABASE_SEND_SMS_HOOK_URI in supabase/.env, usually 3000).
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./.e2e/results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Mobile-first: most traffic is on phones (AGENTS.md §5.11).
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: BASE_URL,
    env: { ...serverEnv(), E2E_PORT: String(PORT) },
    // Never reuse a dev server: it would be pointed at the hosted project, not the local stack.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
