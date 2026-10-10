import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// E2E runs the app against the local Supabase stack (`supabase start`), never the hosted project.
// Process env beats .env.local in Next, so these overrides win over whatever .env.local points at.

export const ROOT = path.resolve(__dirname, "../..");
export const SERVER_LOG = path.join(ROOT, ".e2e", "server.log");
export const WEBHOOK_SECRET = "e2e_razorpay_webhook_secret";

function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2].replace(/\s+#.*$/, "").replace(/^"(.*)"$/, "$1").trim()]),
  );
}

const supabaseEnv = readEnvFile(path.join(ROOT, "supabase", ".env"));

// The app must listen where the local Send SMS Hook calls it, or WhatsApp OTP requests never reach
// it. The running auth container is the truth (it keeps the URI it was started with); fall back to
// supabase/.env. E2E_PORT overrides both.
function hookUri(): string {
  const projectId = readFileSync(path.join(ROOT, "supabase", "config.toml"), "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  try {
    const env = execSync(`docker inspect supabase_auth_${projectId} --format "{{range .Config.Env}}{{println .}}{{end}}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const uri = env.match(/^GOTRUE_HOOK_SEND_SMS_URI=(.+)$/m)?.[1];
    if (uri) return uri.trim();
  } catch {
    // Docker CLI unavailable; use the file.
  }
  return supabaseEnv.SUPABASE_SEND_SMS_HOOK_URI || "http://localhost:3000";
}

export const PORT = Number(process.env.E2E_PORT || new URL(hookUri()).port || 80);
export const BASE_URL = `http://localhost:${PORT}`;

let cachedStack: { url: string; anonKey: string; serviceRoleKey: string; mailUrl: string } | undefined;

export function localStack() {
  if (cachedStack) return cachedStack;
  let out: string;
  try {
    out = execSync("npx supabase status -o env", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
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
  cachedStack = {
    url: env.API_URL,
    anonKey: env.ANON_KEY,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
    mailUrl: env.MAILPIT_URL ?? env.INBUCKET_URL,
  };
  return cachedStack;
}

// Razorpay **test** keys are needed to create real test-mode orders server-side. They come from the
// shell or .env.local; live keys are refused so e2e can never touch real money.
export function razorpayTestKeys(): { keyId: string; keySecret: string } | null {
  const local = readEnvFile(path.join(ROOT, ".env.local"));
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || local.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || local.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  if (!keyId.startsWith("rzp_test_")) throw new Error("E2E refuses to run with live Razorpay keys");
  return { keyId, keySecret };
}

// Environment for the Next server Playwright starts.
export function serverEnv(): Record<string, string> {
  const stack = localStack();
  const rzp = razorpayTestKeys();
  return {
    NEXT_PUBLIC_SITE_URL: BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: stack.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    SUPABASE_SEND_SMS_HOOK_SECRET: supabaseEnv.SUPABASE_SEND_SMS_HOOK_SECRET ?? "",
    ORDER_LINK_SECRET: "e2e-order-link-secret-0123456789abcdef",
    // Cloudflare's always-pass Turnstile test keys (the local stack uses the matching secret).
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: rzp?.keyId ?? "",
    RAZORPAY_KEY_SECRET: rzp?.keySecret ?? "",
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    WHATSAPP_DRY_RUN: "true",
    // Empty Resend key: order emails are logged, not sent.
    RESEND_API_KEY: "",
    SENTRY_DSN: "",
    NEXT_PUBLIC_SENTRY_DSN: "",
  };
}
