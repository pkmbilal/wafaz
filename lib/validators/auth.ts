import { z } from "zod";

// Indian mobile numbers: 10 digits starting 6–9, stored as E.164 (+91XXXXXXXXXX).
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

// Accepts "98765 43210", "098765-43210", "+91 98765 43210", "919876543210".
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? `+91${digits}` : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v, ctx) => {
    const e164 = normalizeIndianMobile(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return e164;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Enter a valid email address" }));

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const OTP_CHANNELS = ["whatsapp", "email"] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

// "signin": signInWithOtp. "change": updateUser on the current (anonymous or signed-in) user.
export const OTP_FLOWS = ["signin", "change"] as const;
export type OtpFlow = (typeof OTP_FLOWS)[number];

const captchaToken = z.string().min(1, "Please complete the security check").max(4096);

export const requestOtpSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("whatsapp"), identifier: phoneSchema, captchaToken }),
  z.object({ channel: z.literal("email"), identifier: emailSchema, captchaToken }),
]);
export type RequestOtpInput = z.input<typeof requestOtpSchema>;

export const verifyOtpSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("whatsapp"),
    identifier: phoneSchema,
    code: otpCodeSchema,
    flow: z.enum(OTP_FLOWS),
    next: z.string().max(500).optional(),
  }),
  z.object({
    channel: z.literal("email"),
    identifier: emailSchema,
    code: otpCodeSchema,
    flow: z.enum(OTP_FLOWS),
    next: z.string().max(500).optional(),
  }),
]);
export type VerifyOtpInput = z.input<typeof verifyOtpSchema>;

// Only same-origin relative paths; anything else falls back to the account page.
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(next) || next.startsWith("/login")) return fallback;
  return next;
}

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(120),
});

export const marketingConsentSchema = z.object({ consent: z.boolean() });

export const addressSchema = z.object({
  name: z.string().trim().min(1, "Enter the recipient's name").max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(1, "Enter the house / building and street").max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  city: z.string().trim().min(1, "Enter the city or town").max(100),
  stateCode: z.string().regex(/^\d{2}$/, "Choose a state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressOutput = z.output<typeof addressSchema>;

export const idSchema = z.uuid();
