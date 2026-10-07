import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

// Guest order links: /orders/[id]?t=<token>, an HMAC of the order id and email (AGENTS.md §5.8).
// Links never expire but only grant read-only access to that one order.

export function orderLinkToken(orderId: string, email: string, secret: string = serverEnv().ORDER_LINK_SECRET): string {
  return createHmac("sha256", secret).update(`${orderId}:${email.trim().toLowerCase()}`).digest("base64url");
}

export function verifyOrderLinkToken(
  orderId: string,
  email: string,
  token: string,
  secret: string = serverEnv().ORDER_LINK_SECRET,
): boolean {
  const expected = Buffer.from(orderLinkToken(orderId, email, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
