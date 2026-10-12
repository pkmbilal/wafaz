import "server-only";
import { z } from "zod";

// Secrets are parsed lazily so a missing var fails the code path that needs it,
// not the whole build. Add vars here as each milestone starts using them.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  ORDER_LINK_SECRET: z.string().min(32),
  // Without a Resend key, dev logs emails instead of sending them; production records a failure.
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().startsWith("re_").optional()),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  // R2 is only needed for admin image uploads; without it the upload endpoint reports it as unavailable.
  R2_ACCOUNT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_PUBLIC_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
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
        cache.set(k, serverSchema.shape[k].parse(process.env[k]));
      }
      return cache.get(k);
    },
  });
}
