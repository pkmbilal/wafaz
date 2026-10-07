import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Cookie-less anon client for cached catalog reads ("use cache" scopes can't read cookies).
// It never holds a session, so catalog pages stay cacheable and RLS sees the `anon` role.
export function createPublicClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
