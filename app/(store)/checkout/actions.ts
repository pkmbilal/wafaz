"use server";

import { headers } from "next/headers";
import { quoteForUser, type QuoteResult } from "@/lib/checkout/quote";
import { couponMessage, couponRejectionFromDbError } from "@/lib/pricing";
import { RATE_LIMITS, rateLimitSelf } from "@/lib/rate-limit";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { clientIp } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { placeOrderSchema, quoteSchema, verifyPaymentSchema } from "@/lib/validators/checkout";

// Checkout runs as the current user (guest or registered). Prices are never taken from the client:
// the quote is computed from the cart here, and the order is priced again in the DB.

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function sessionClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ? supabase : null;
}

export async function getCheckoutQuote(input: unknown): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await sessionClient();
  if (!supabase) return { ok: false, error: "Your session has expired. Please refresh the page." };

  if (parsed.data.couponCode && !(await rateLimitSelf(supabase, "coupon-apply", RATE_LIMITS.couponApply))) {
    const result = await quoteForUser(supabase, { ...parsed.data, couponCode: undefined });
    return result.ok ? { ...result, couponError: "Too many coupon attempts. Try again in a few minutes." } : result;
  }
  return quoteForUser(supabase, parsed.data);
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; totalPaise: number }
  | { ok: false; error: string; field?: "coupon" | "cart" };

const ORDER_ERRORS: Record<string, { error: string; field?: "coupon" | "cart" }> = {
  "checkout:empty": { error: "Your cart is empty.", field: "cart" },
  "checkout:unavailable": { error: "An item in your cart is no longer available.", field: "cart" },
  "checkout:no_shipping": { error: "We don't deliver to this state yet." },
  "checkout:minimum": { error: "The order total is too low to pay online." },
  "checkout:address": { error: "Please check the delivery address." },
  "checkout:email": { error: "Please check your email address." },
  "checkout:phone": { error: "Please check your mobile number." },
  insufficient_stock: { error: "Some items just sold out. Please review your cart.", field: "cart" },
};

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const supabase = await sessionClient();
  if (!supabase) return { ok: false, error: "Your session has expired. Please refresh the page." };

  const ip = clientIp(await headers());
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return { ok: false, error: "We couldn't verify your browser. Please try again." };
  }
  if (!(await rateLimitSelf(supabase, "order-create", RATE_LIMITS.orderCreate))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const { contact, address, couponCode } = parsed.data;
  const { data, error } = await supabase
    .rpc("create_order_from_cart", {
      p_address: {
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state_code: address.stateCode,
        pincode: address.pincode,
      },
      p_email: contact.email,
      p_phone: contact.phone,
      p_coupon_code: couponCode ?? undefined,
    })
    .single();

  if (error) {
    const coupon = couponRejectionFromDbError(error.message);
    if (coupon) return { ok: false, error: couponMessage(coupon), field: "coupon" };
    const known = ORDER_ERRORS[error.message];
    if (known) return { ok: false, ...known };
    console.error("[checkout] create_order_from_cart failed", error.code);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, orderId: data.order_id, orderNumber: data.order_number, totalPaise: data.total_paise };
}

// Checkout success handler. A valid signature only means "show the confirming state": the
// webhook is the source of truth for marking the order paid (AGENTS.md §5.4).
export async function verifyPayment(input: unknown): Promise<{ ok: boolean }> {
  const parsed = verifyPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: verifyPaymentSignature(parsed.data) };
}
