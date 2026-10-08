import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "cn";
import { mediaUrl } from "@/lib/r2";

function safeMediaUrl(key: string): string | null {
  try {
    return mediaUrl(key);
  } catch {
    return null;
  }
}

// Small 3:4 product-style preview for admin lists and forms.
export function Thumb({ imageKey, alt = "", className }: { imageKey: string | null; alt?: string; className?: string }) {
  const src = imageKey ? safeMediaUrl(imageKey) : null;
  return (
    <div className={cn("relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-sm bg-muted", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="160px" className="object-cover" />
      ) : (
        <ImageOff aria-hidden className="absolute inset-0 m-auto size-4 text-muted-foreground" />
      )}
    </div>
  );
}
