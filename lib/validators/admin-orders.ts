import { z } from "zod";
import { COURIERS } from "@/lib/shipping/tracking";

// Inputs for the admin order screens and Server Actions (app/admin/(protected)/orders).

export const ORDER_STATUSES = ["pending_payment", "confirmed", "cancelled", "expired", "completed"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "partially_refunded", "refunded", "failed"] as const;
export const FULFILLMENT_STATUSES = ["unfulfilled", "packed", "shipped", "delivered", "returned_to_origin"] as const;

export const ORDERS_PAGE_SIZE = 25;

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

// List filters come from the URL; anything malformed is dropped instead of erroring.
export const orderFiltersSchema = z.object({
  order: optionalEnum(ORDER_STATUSES),
  payment: optionalEnum(PAYMENT_STATUSES),
  fulfillment: optionalEnum(FULFILLMENT_STATUSES),
  attention: z.literal("1").optional().catch(undefined),
  // Order number, email or phone. Restricted to characters that are safe inside a PostgREST filter.
  q: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z0-9@.+_-]*$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export const orderIdSchema = z.uuid();

export const shipOrderSchema = z.object({
  orderId: z.uuid(),
  courier: z.enum(COURIERS),
  trackingNumber: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9-]{3,40}$/, "Enter the tracking number (letters, digits and dashes)")),
});

const reasonSchema = z.string().trim().min(3, "Add a short reason").max(500);

const refundItemsSchema = z
  .array(z.object({ orderItemId: z.uuid(), qty: z.number().int().min(1).max(10) }))
  .max(50);

export const refundPreviewSchema = z.object({
  orderId: z.uuid(),
  items: refundItemsSchema,
  includeShipping: z.boolean(),
});

export const refundOrderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("partial"),
    orderId: z.uuid(),
    items: refundItemsSchema,
    includeShipping: z.boolean(),
    reason: reasonSchema,
  }),
  z.object({ kind: z.literal("cancel"), orderId: z.uuid(), reason: reasonSchema }),
  z.object({ kind: z.literal("rto"), orderId: z.uuid(), includeShipping: z.boolean(), reason: reasonSchema }),
]);

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export const resolveAttentionSchema = z.object({
  orderId: z.uuid(),
  note: z.string().trim().min(3, "Say how it was resolved").max(500),
});

export const failStuckRefundSchema = z.object({ orderId: z.uuid(), refundId: z.uuid() });
