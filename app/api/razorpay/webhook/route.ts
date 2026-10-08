import { revalidateTag } from "next/cache";
import { NextResponse, after } from "next/server";
import { cacheTags } from "@/lib/cache-tags";
import { sendNotices } from "@/lib/notifications";
import { handleRazorpayWebhook } from "@/lib/payments/razorpay-webhook";
import { refundPayment } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

// Razorpay webhook (payment.captured, payment.failed). Returns 500 on processing errors so
// Razorpay retries; every failure is recorded on the webhook_events row.
export async function POST(req: Request) {
  // Raw body first: the signature covers the exact bytes.
  const rawBody = await req.text();

  const admin = createAdminClient();
  const result = await handleRazorpayWebhook(
    {
      rawBody,
      signature: req.headers.get("x-razorpay-signature"),
      eventId: req.headers.get("x-razorpay-event-id"),
    },
    {
      admin,
      refund: refundPayment,
      onStockChanged: (productIds) => {
        for (const id of productIds) revalidateTag(cacheTags.product(id), "max");
        // Listings show "Sold out" badges.
        revalidateTag(cacheTags.catalog, "max");
      },
      // Emails go out after the 200 so a slow or failing send never makes Razorpay retry a
      // processed payment. Each send is logged in email_events.
      notify: (notices) => after(() => sendNotices(notices, { admin })),
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
