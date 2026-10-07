import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// DB integration tests run against the local stack (`supabase start`), never the hosted project.
// URLs and keys come from `supabase status` so .env.local can keep pointing elsewhere.

type LocalStack = { url: string; anonKey: string; serviceRoleKey: string };

let stack: LocalStack | undefined;

export function localStack(): LocalStack {
  if (stack) return stack;
  let out: string;
  try {
    out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `supabase start`.");
  }
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  stack = { url: env.API_URL, anonKey: env.ANON_KEY, serviceRoleKey: env.SERVICE_ROLE_KEY };
  return stack;
}

// Cloudflare's always-pass test secret is configured locally; it accepts this dummy token.
export const TEST_CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export type TestClient = SupabaseClient<Database>;

export function adminClient(): TestClient {
  const { url, serviceRoleKey } = localStack();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): TestClient {
  const { url, anonKey } = localStack();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// A registered (non-anonymous) customer with a signed-in client. Passwords are a test harness
// only; the app itself never offers password login.
export async function createCustomer(): Promise<{ id: string; email: string; client: TestClient }> {
  const email = `test-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: TEST_CAPTCHA_TOKEN },
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function createGuest(): Promise<{ id: string; client: TestClient }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously({
    options: { captchaToken: TEST_CAPTCHA_TOKEN },
  });
  if (error || !data.user) throw error ?? new Error("signInAnonymously failed");
  return { id: data.user.id, client };
}

export async function deleteUsers(...ids: (string | undefined)[]) {
  const admin = adminClient();
  await Promise.all(ids.filter(Boolean).map((id) => admin.auth.admin.deleteUser(id!)));
}

type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"];

export function testAddress(
  overrides: Partial<AddressInsert> & Pick<AddressInsert, "user_id">,
): AddressInsert {
  return {
    name: "Asha Nair",
    phone: "+919876543210",
    line1: "12 MG Road",
    city: "Kochi",
    state_code: "32",
    pincode: "682016",
    ...overrides,
  };
}
