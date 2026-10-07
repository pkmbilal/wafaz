import { randomBytes, randomInt } from "node:crypto";
import { adminClient, type TestClient } from "./helpers";

// Shared setup for order, payment and webhook tests against the local stack.

export const ADDRESS_KERALA = {
  name: "Asha Nair",
  phone: "+919876543210",
  line1: "12 MG Road",
  city: "Kochi",
  state_code: "32",
  pincode: "682016",
};

export const ADDRESS_KARNATAKA = { ...ADDRESS_KERALA, city: "Bengaluru", state_code: "29", pincode: "560001" };

export type StockedVariant = { id: string; productId: string; pricePaise: number; originalStock: number };

// Active variants (not used by the cart tests), with their stock set for the test. Call
// restoreStock() in afterAll.
export async function stockVariants(count: number, stock: number, offset = 0): Promise<StockedVariant[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("product_variants")
    .select("id, product_id, price_paise, stock, products!inner(status)")
    .eq("is_active", true)
    .eq("reserved", 0)
    .eq("products.status", "active")
    .order("sku", { ascending: false })
    .range(offset, offset + count - 1);
  if (error) throw error;
  if (!data || data.length < count) throw new Error("seed needs more active variants");
  await Promise.all(data.map((v) => setStock(v.id, stock)));
  return data.map((v) => ({ id: v.id, productId: v.product_id, pricePaise: v.price_paise, originalStock: v.stock }));
}

export async function setStock(variantId: string, stock: number) {
  const { error } = await adminClient().from("product_variants").update({ stock }).eq("id", variantId);
  if (error) throw error;
}

export async function restoreStock(variants: readonly StockedVariant[]) {
  const admin = adminClient();
  await Promise.all(
    variants.map((v) => admin.from("product_variants").update({ stock: v.originalStock, reserved: 0 }).eq("id", v.id)),
  );
}

export async function addToCart(client: TestClient, variantId: string, qty: number) {
  const { error } = await client.rpc("cart_add_item", { p_variant_id: variantId, p_qty: qty }).single();
  if (error) throw error;
}

export async function createOrder(
  client: TestClient,
  opts: { email: string; phone?: string; address?: typeof ADDRESS_KERALA; coupon?: string } = { email: "" },
) {
  return client
    .rpc("create_order_from_cart", {
      p_address: opts.address ?? ADDRESS_KERALA,
      p_email: opts.email,
      p_phone: opts.phone ?? testPhone(),
      p_coupon_code: opts.coupon,
    })
    .single();
}

// A unique Indian mobile per test buyer: coupon limits match on phone as well as email.
export function testPhone(): string {
  return `+919${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
}

export function fakeRazorpayId(prefix: "order" | "pay" | "rfnd"): string {
  return `${prefix}_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
}

// Records a Razorpay order for the customer's pending order (as the customer) and returns its id.
export async function attachRazorpayOrder(client: TestClient, orderId: string): Promise<string> {
  const rzpOrderId = fakeRazorpayId("order");
  const { error } = await client.rpc("record_razorpay_order", {
    p_order_id: orderId,
    p_razorpay_order_id: rzpOrderId,
  });
  if (error) throw error;
  return rzpOrderId;
}

export async function variantState(variantId: string) {
  const { data, error } = await adminClient()
    .from("product_variants")
    .select("stock, reserved")
    .eq("id", variantId)
    .single();
  if (error) throw error;
  return data;
}

export async function orderRow(orderId: string) {
  const { data, error } = await adminClient()
    .from("orders")
    .select("order_status, payment_status, needs_attention, attention_reason, total_paise, user_id")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data;
}

export async function backdateExpiry(orderId: string) {
  const { error } = await adminClient()
    .from("orders")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}
