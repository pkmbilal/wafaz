import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { cacheTags } from "@/lib/cache-tags";
import { handleRazorpayWebhook } from "@/lib/payments/razorpay-webhook";
import { refundPayment } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

// Razorpay webhook (payment.captured, payment.failed). Returns 500 on processing errors so
// Razorpay retries; every failure is recorded on the webhook_events row.
export async function POST(req: Request) {
  // Raw body first: the signature covers the exact bytes.
  const rawBody = await req.text();

  const result = await handleRazorpayWebhook(
    {
      rawBody,
      signature: req.headers.get("x-razorpay-signature"),
      eventId: req.headers.get("x-razorpay-event-id"),
    },
    {
      admin: createAdminClient(),
      refund: refundPayment,
      onStockChanged: (productIds) => {
        for (const id of productIds) revalidateTag(cacheTags.product(id), "max");
        // Listings show "Sold out" badges.
        revalidateTag(cacheTags.catalog, "max");
      },
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
