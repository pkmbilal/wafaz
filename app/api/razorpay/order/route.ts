import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema } from "@/lib/validators/checkout";

// Creates (or reuses) the Razorpay order for one of the caller's pending orders. The amount is
// always the DB order total (AGENTS.md §5.4 step 1).
export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Online payment is not available right now." }, { status: 503 });
  }

  const parsed = orderIdSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: target, error } = await supabase
    .rpc("order_payment_target", { p_order_id: parsed.data.orderId })
    .single();
  if (error || !target) {
    return NextResponse.json(
      { error: "This order can no longer be paid. Please place it again.", code: "not_payable" },
      { status: 409 },
    );
  }

  let razorpayOrderId = target.razorpay_order_id;
  if (!razorpayOrderId) {
    try {
      const created = await createRazorpayOrder({
        amountPaise: target.total_paise,
        receipt: target.order_number,
        orderId: parsed.data.orderId,
      });
      razorpayOrderId = created.id;
    } catch {
      console.error("[razorpay] order create failed");
      return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
    }
    const { error: recordError } = await supabase.rpc("record_razorpay_order", {
      p_order_id: parsed.data.orderId,
      p_razorpay_order_id: razorpayOrderId,
    });
    if (recordError) {
      return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      razorpayOrderId,
      amountPaise: target.total_paise,
      orderNumber: target.order_number,
      email: target.email,
      phone: target.phone,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
