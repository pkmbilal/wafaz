import { z } from "zod";
import { addressSchema, emailSchema, phoneSchema } from "@/lib/validators/auth";

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, "Enter a valid coupon code");

export const contactSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
});
export type ContactInput = z.input<typeof contactSchema>;

export const quoteSchema = z.object({
  stateCode: z.string().regex(/^\d{2}$/),
  couponCode: couponCodeSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export const placeOrderSchema = z.object({
  contact: contactSchema,
  address: addressSchema,
  couponCode: couponCodeSchema.optional(),
  turnstileToken: z.string().min(1).max(2048),
});

export const orderIdSchema = z.object({ orderId: z.uuid() });

export const verifyPaymentSchema = z.object({
  orderId: z.uuid(),
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
