"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { cn } from "cn";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { mediaUrl } from "@/lib/r2";
import type { ProductMedia } from "@/lib/catalog/queries";

// Shows the images for the selected colour (plus colour-less images). Swipe on mobile,
// arrows + thumbnails everywhere.
export function ProductGallery({ media, title }: { media: ProductMedia[]; title: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange);
      return () => {
        api.off("select", onChange);
      };
    },
    [api],
  );
  const current = useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  );

  if (media.length === 0) {
    return <div className="aspect-4/5 w-full rounded-md bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Carousel setApi={setApi} aria-label={`${title} images`} className="overflow-hidden rounded-md bg-muted">
        <CarouselContent className="ml-0">
          {media.map((m, i) => (
            <CarouselItem key={m.id} className="pl-0">
              <div className="relative aspect-4/5">
                <Image
                  src={mediaUrl(m.key)}
                  alt={m.alt ?? `${title}, image ${i + 1}`}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {media.length > 1 && (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        )}
      </Carousel>

      {media.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose image">
          {media.map((m, i) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => api?.scrollTo(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === current}
                className={cn(
                  "relative block aspect-4/5 w-16 overflow-hidden rounded-sm border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                  i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={mediaUrl(m.key)} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
