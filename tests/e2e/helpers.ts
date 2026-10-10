import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BASE_URL, ROOT, SERVER_LOG, WEBHOOK_SECRET, localStack } from "./env";

export function adminClient() {
  const { url, serviceRoleKey } = localStack();
  return createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// An active product with an in-stock variant, plus that variant's size.
export async function inStockProduct(): Promise<{ slug: string; size: string }> {
  const { data, error } = await adminClient()
    .from("product_variants")
    .select("size, stock, reserved, products!inner(slug, status)")
    .eq("is_active", true)
    .eq("products.status", "active")
    .gt("stock", 5)
    .limit(20);
  if (error) throw error;
  const variant = data?.find((v) => v.stock - v.reserved > 0);
  if (!variant) throw new Error("Seed has no in-stock active variant; run `supabase db reset`.");
  return { slug: variant.products.slug, size: variant.size };
}

export function uniqueEmail() {
  return `e2e-${randomUUID()}@example.com`;
}

// A random valid Indian mobile, 10 digits starting 9.
export function uniquePhone() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

async function poll<T>(fn: () => Promise<T | null> | T | null, what: string, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value !== null) return value;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

// Email OTP from the local Mailpit inbox.
export function emailOtp(email: string): Promise<string> {
  const { mailUrl } = localStack();
  return poll(async () => {
    const search = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (!search.ok) return null;
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (!messages?.length) return null;
    const message = await fetch(`${mailUrl}/api/v1/message/${messages[0].ID}`);
    const { Text, HTML } = (await message.json()) as { Text?: string; HTML?: string };
    return `${Text ?? ""} ${HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1] ?? null;
  }, `an email OTP for ${email}`);
}

// WhatsApp OTP from the dry-run line the send-otp hook logs (lib/whatsapp.ts).
export function whatsappOtp(phone: string): Promise<string> {
  const pattern = new RegExp(`\\[whatsapp:dry-run\\] OTP for \\*+${phone.slice(-4)}: (\\d{6})`, "g");
  return poll(() => {
    const matches = [...readFileSync(SERVER_LOG, "utf8").matchAll(pattern)];
    return matches.at(-1)?.[1] ?? null;
  }, `a WhatsApp OTP for ******${phone.slice(-4)}`);
}

// The Turnstile widget (always-pass test key locally) writes its token into a hidden input;
// forms refuse to submit until it has.
export async function waitForTurnstile(page: Page) {
  await expect
    .poll(() => page.locator('input[name="cf-turnstile-response"]').first().inputValue().catch(() => ""), {
      message: "Turnstile token",
      timeout: 30_000,
    })
    .not.toBe("");
}

export async function fillOtp(page: Page, code: string) {
  await page.getByLabel("6-digit code").fill(code);
}

// Stands in for Razorpay Checkout in the browser. The server still creates a real test-mode
// Razorpay order; this stub "pays" it by delivering a signed payment.captured webhook (the source
// of truth) and then calling Checkout's success handler with a correctly signed response.
export async function stubRazorpayCheckout(page: Page, keySecret: string) {
  await page.exposeFunction("__e2ePay", async (razorpayOrderId: string, amount: number) => {
    const paymentId = `pay_E2E${randomBytes(6).toString("hex")}`;
    await deliverWebhook("payment.captured", { razorpayOrderId, paymentId, amount });
    const signature = createHmac("sha256", keySecret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
    return { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
  });

  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        window.Razorpay = function (options) { this.options = options; };
        window.Razorpay.prototype.on = function () {};
        window.Razorpay.prototype.open = function () {
          var o = this.options;
          window.__e2ePay(o.order_id, o.amount).then(function (r) { o.handler(r); });
        };
      `,
    }),
  );
}

export async function deliverWebhook(
  name: "payment.captured" | "payment.failed",
  values: { razorpayOrderId: string; paymentId: string; amount: number },
) {
  const raw = readFileSync(path.join(ROOT, "tests", "fixtures", "razorpay", `${name}.json`), "utf8")
    .replace("{{RZP_ORDER_ID}}", values.razorpayOrderId)
    .replace("{{PAYMENT_ID}}", values.paymentId)
    .replace('"{{AMOUNT}}"', String(values.amount));
  const res = await fetch(`${BASE_URL}/api/razorpay/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"),
      "x-razorpay-event-id": `evt_e2e_${randomUUID()}`,
    },
    body: raw,
  });
  expect(res.status, await res.clone().text()).toBe(200);
}
