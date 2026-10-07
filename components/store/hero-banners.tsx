"use client";

import Image from "next/image";
import Link from "next/link";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { mediaUrl } from "@/lib/r2";

type Banner = { id: string; title: string; image_key: string; link: string | null };

export function HeroBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <Carousel opts={{ loop: true }} aria-label="Featured" className="overflow-hidden bg-muted">
      <CarouselContent className="ml-0">
        {banners.map((b, i) => {
          const image = (
            <div className="relative aspect-4/3 sm:aspect-12/5">
              <Image
                src={mediaUrl(b.image_key)}
                alt={b.title}
                fill
                sizes="100vw"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className="object-cover"
              />
            </div>
          );
          return (
            <CarouselItem key={b.id} className="pl-0">
              {b.link ? (
                <Link href={b.link} className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset">
                  {image}
                </Link>
              ) : (
                image
              )}
            </CarouselItem>
          );
        })}
      </CarouselContent>
      {banners.length > 1 && (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      )}
    </Carousel>
  );
}
