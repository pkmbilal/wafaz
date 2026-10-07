"use client";

import type { ImageLoaderProps } from "next/image";

// next/image loader (AGENTS.md §5.9). Pass `mediaUrl(key)` as `src`.
// - Local files (seed placeholders under /public) are served as-is; `w` only keeps srcset URLs distinct.
// - Remote media goes through Cloudflare Image Resizing on the media domain.
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith("/")) {
    return `${src}?w=${width}`;
  }

  const url = new URL(src);
  const options = `width=${width},quality=${quality ?? 75},format=auto,fit=scale-down`;
  return `${url.origin}/cdn-cgi/image/${options}${url.pathname}`;
}
