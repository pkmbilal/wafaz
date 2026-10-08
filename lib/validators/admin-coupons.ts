import { z } from "zod";
import { istLocalToIso, rupeesToPaise } from "@/lib/catalog/admin-input";

// Coupon form (app/admin/(protected)/coupons). Owner-only. Codes are stored uppercase
// (DATA_MODEL §1); used_count is maintained by commit_order_payment only.

export const COUPON_KINDS = ["percent", "flat"] as const;

const optionalRupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const paise = rupeesToPaise(v);
      if (paise === null || paise <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter the ${label} in rupees` });
        return z.NEVER;
      }
      return paise;
    });

const optionalCount = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 1_000_000) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number of 1 or more` });
        return z.NEVER;
      }
      return Number(v);
    });

const istDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const iso = istLocalToIso(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return iso;
  });

export const couponSchema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, "Use 3–30 capital letters, digits or dashes")),
    kind: z.enum(COUPON_KINDS),
    // Percent off (whole number) or rupees off, depending on kind.
    value: z.string().trim(),
    maxDiscount: optionalRupees("maximum discount"),
    minCart: optionalRupees("minimum cart value"),
    maxUses: optionalCount("Total uses"),
    perUserLimit: optionalCount("Uses per customer"),
    firstOrderOnly: z.boolean(),
    startsAt: istDateTime,
    endsAt: istDateTime,
    isActive: z.boolean(),
  })
  .transform((c, ctx) => {
    let value: number | null = null;
    if (c.kind === "percent") {
      value = /^\d{1,3}$/.test(c.value) && Number(c.value) >= 1 && Number(c.value) <= 100 ? Number(c.value) : null;
      if (value === null) ctx.addIssue({ code: "custom", message: "Enter a whole percent from 1 to 100", path: ["value"] });
    } else {
      value = rupeesToPaise(c.value);
      if (!value) ctx.addIssue({ code: "custom", message: "Enter the discount in rupees", path: ["value"] });
    }
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) {
      ctx.addIssue({ code: "custom", message: "The end must be after the start", path: ["endsAt"] });
    }
    if (value === null) return z.NEVER;
    return {
      ...c,
      value,
      // A cap only makes sense on a percentage discount.
      maxDiscount: c.kind === "percent" ? c.maxDiscount : null,
    };
  });

export type CouponInput = z.input<typeof couponSchema>;
export type Coupon = z.output<typeof couponSchema>;
