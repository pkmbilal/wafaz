import { z } from "zod";
import { percentToBps } from "@/lib/catalog/admin-input";

// Store settings form (app/admin/(protected)/settings). Owner-only; einvoice_enabled is never
// exposed (AGENTS.md §5.2).

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const text = (label: string, max: number) => z.string().trim().min(1, `Add the ${label}`).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const email = (label: string) => z.string().trim().toLowerCase().max(254).pipe(z.email(`Enter a valid ${label}`));
// Support lines may be landlines, so any 10-digit Indian number.
const phone = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .transform((v) => (/^\d{10}$/.test(v) ? `+91${v}` : v))
    .pipe(z.string().regex(/^\+91\d{10}$/, `Enter the ${label} as a 10-digit number`));
const count = (label: string, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .pipe(z.number().int().max(max, `${label} can be at most ${max}`));
const prefix = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{1,5}$/, "Use 1 to 5 capital letters"));

export const settingsSchema = z
  .object({
    legalName: text("legal name", 200),
    tradeName: text("trade name", 120),
    gstin: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === "" || GSTIN_PATTERN.test(v), "Enter a valid 15-character GSTIN")
      .transform((v) => (v === "" ? null : v)),
    addressLine1: text("address", 200),
    addressLine2: optionalText(200),
    city: text("city", 100),
    stateCode: z.string().regex(/^\d{2}$/, "Choose a state"),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit PIN code"),
    supportEmail: email("support email"),
    supportPhone: phone("support phone"),
    grievanceOfficerName: text("grievance officer's name", 120),
    grievanceOfficerEmail: email("grievance officer email"),
    grievanceOfficerPhone: phone("grievance officer phone"),
    invoicePrefix: prefix,
    creditNotePrefix: prefix,
    taxSlabBasis: z.enum(["inclusive", "taxable"]),
    // Empty = use the highest GST rate in the order (lib/pricing.ts).
    shippingTaxRate: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const bps = percentToBps(v);
        if (bps === null) {
          ctx.addIssue({ code: "custom", message: "Enter a percent from 0 to 100" });
          return z.NEVER;
        }
        return bps;
      }),
    lowStockThreshold: count("Low-stock threshold", 1000),
    newBadgeDays: count("NEW badge days", 365),
  })
  .refine((v) => !v.gstin || v.gstin.slice(0, 2) === v.stateCode, {
    message: "The GSTIN's first two digits must match the state code",
    path: ["gstin"],
  })
  .refine((v) => v.invoicePrefix !== v.creditNotePrefix, {
    message: "Use a different prefix from invoices",
    path: ["creditNotePrefix"],
  });

export type SettingsInput = z.input<typeof settingsSchema>;
export type Settings = z.output<typeof settingsSchema>;
