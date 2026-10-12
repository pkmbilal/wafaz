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

// Supabase hashes with bcrypt, which only reads the first 72 bytes.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72, "Incorrect email or password."),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords don't match",
    path: ["confirmPassword"],
  });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords don't match",
    path: ["confirmPassword"],
  });

// Auth pages never make sense as a post-login destination.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

// Only same-origin relative paths; anything else falls back to the account page.
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(next) || AUTH_PATHS.some((p) => next.startsWith(p))) {
    return fallback;
  }
  return next;
}

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(120),
});

// Contact number on the profile, used as the default at checkout. Empty clears it.
export const profilePhoneSchema = z.object({
  phone: z.union([z.literal("").transform(() => null), phoneSchema]),
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
