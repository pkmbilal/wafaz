import { vi } from "vitest";

// lib/env.ts parses NEXT_PUBLIC_* at import time; call this before importing modules that use it.
export function stubPublicEnv(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
    NEXT_PUBLIC_MEDIA_URL: "",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_dummy",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}
