"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { heroSlides } from "@/components/store/hero-slides";
import { mediaUrl } from "@/lib/r2";

const AUTOPLAY_MS = 6000;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function HeroSlider() {
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Server render assumes reduced motion, so autoplay only starts once the browser says it's fine.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );

  const subscribeSelect = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange);
      api.on("reInit", onChange);
      return () => {
        api.off("select", onChange);
        api.off("reInit", onChange);
      };
    },
    [api],
  );
  const selected = useSyncExternalStore(
    subscribeSelect,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  );

  // Autoplay pauses while the pointer or keyboard focus is inside, and when the visitor stops it.
  const autoplay = playing && !reducedMotion && !hovered && !focused;
  useEffect(() => {
    if (!api || !autoplay) return;
    const timer = window.setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api, autoplay, selected]);

  const total = heroSlides.length;

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true }}
      aria-label="Featured collections"
      className="bg-secondary"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <CarouselContent className="ml-0" aria-live={autoplay ? "off" : "polite"}>
        {heroSlides.map((slide, i) => {
          const Heading = i === 0 ? "h1" : "h2";
          return (
            <CarouselItem
              key={slide.id}
              aria-label={`${i + 1} of ${total}`}
              // Off-screen slides stay out of the tab order and the accessibility tree.
              inert={i !== selected}
              className="pl-0"
            >
              <div className="grid md:min-h-144 md:grid-cols-2 lg:min-h-160">
                <div className="relative h-112 bg-muted md:order-last md:h-auto">
                  <Image
                    src={mediaUrl(slide.imageKey)}
                    alt={slide.imageAlt}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    className="object-cover object-top"
                  />
                </div>
                <div className="flex flex-col justify-center px-4 pt-10 pb-24 md:px-10 md:py-24 lg:px-16 xl:px-24">
                  <div className="flex max-w-xl flex-col items-start gap-5 lg:gap-6">
                    <p className="eyebrow text-muted-foreground">{slide.eyebrow}</p>
                    <Heading className="text-5xl leading-tight sm:text-6xl lg:text-7xl">
                      {slide.heading}{" "}
                      <span className="block italic text-primary">{slide.headingAccent}</span>
                    </Heading>
                    <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">{slide.body}</p>
                    <Button asChild size="lg" className="mt-2 rounded-full">
                      <Link href={slide.href}>
                        {slide.cta}
                        <ArrowRight aria-hidden className="size-4 transition-transform group-hover/button:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>

      {/* Controls sit under the text column on desktop and along the bottom on mobile. */}
      <div className="absolute inset-x-0 bottom-4 flex items-center gap-1 px-2 md:right-1/2 md:px-6 lg:px-12 xl:px-20">
        <CarouselPrevious className="static my-0 max-md:hidden" />
        <div className="flex items-center">
          {heroSlides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Go to slide ${i + 1}: ${slide.heading} ${slide.headingAccent}`}
              aria-current={i === selected ? "true" : undefined}
              className="group/dot flex size-touch items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === selected ? "w-6 bg-primary" : "w-1.5 bg-foreground/30 group-hover/dot:bg-foreground/60",
                )}
              />
            </button>
          ))}
        </div>
        <CarouselNext className="static my-0 max-md:hidden" />
        {!reducedMotion && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            className="ml-1 rounded-full"
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
        )}
      </div>
    </Carousel>
  );
}
