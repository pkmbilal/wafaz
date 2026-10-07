import { publicEnv } from "@/lib/env";

// The DB stores object keys only; every public media URL is built here (AGENTS.md §5.9).
// Keys under `seed/` are dev placeholders shipped in public/seed/.
const SEED_PREFIX = "seed/";

export function mediaUrl(key: string, baseUrl = publicEnv.NEXT_PUBLIC_MEDIA_URL): string {
  const cleanKey = key.replace(/^\/+/, "");

  if (cleanKey.startsWith(SEED_PREFIX)) {
    return `/${cleanKey}`;
  }

  if (!baseUrl) {
    throw new Error(`NEXT_PUBLIC_MEDIA_URL is not set; cannot build a URL for "${cleanKey}"`);
  }

  return `${baseUrl.replace(/\/+$/, "")}/${cleanKey}`;
}
