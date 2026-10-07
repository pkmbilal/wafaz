import "server-only";
import { z } from "zod";

// Secrets are parsed lazily so a missing var fails the code path that needs it,
// not the whole build. Add vars here as each milestone starts using them.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_SEND_SMS_HOOK_SECRET: z.string().startsWith("v1,whsec_"),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  ORDER_LINK_SECRET: z.string().min(32),
  // WhatsApp credentials are only required when real sends are enabled.
  WHATSAPP_DRY_RUN: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),
  WHATSAPP_PHONE_NUMBER_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_OTP_TEMPLATE_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_OTP_TEMPLATE_LANG: z.preprocess(emptyToUndefined, z.string().default("en")),
});

type ServerEnv = z.infer<typeof serverSchema>;

const cache = new Map<keyof ServerEnv, unknown>();

// Reads one var at a time so a route only needs the secrets it actually uses.
export function serverEnv(): ServerEnv {
  return new Proxy({} as ServerEnv, {
    get(_target, key: string) {
      const k = key as keyof ServerEnv;
      if (!(k in serverSchema.shape)) return undefined;
      if (!cache.has(k)) {
        const value = serverSchema.shape[k].parse(process.env[k]);
        if (k === "WHATSAPP_DRY_RUN" && value === "true" && process.env.NODE_ENV === "production") {
          throw new Error("WHATSAPP_DRY_RUN must be false in production");
        }
        cache.set(k, value);
      }
      return cache.get(k);
    },
  });
}
