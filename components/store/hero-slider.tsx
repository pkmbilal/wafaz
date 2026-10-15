"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getImageProps } from "next/image";
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
import { type HeroSlide, heroSlides } from "@/components/store/hero-slides";
import { TrustBadges } from "@/components/store/trust-badges";
import { mediaUrl } from "@/lib/r2";

const AUTOPLAY_MS = 6000;

function useMediaQuery(query: string, serverValue: boolean) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}

export function HeroSlider() {
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Server render assumes no autoplay, so it only starts once the browser says it's fine.
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  // Phones have no slider controls (swipe only), so there's no pause button: no autoplay either.
  const desktop = useMediaQuery("(min-width: 768px)", false);

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
  const autoplay = playing && desktop && !reducedMotion && !hovered && !focused;
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
      // Pulled up under the sticky header (h-16 / lg:h-20), which turns transparent over it.
      data-header-overlay
      className="-mt-16 bg-secondary lg:-mt-20"
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
              <div className="relative h-svh max-h-240 min-h-144">
                <SlideImage slide={slide} eager={i === 0} />
                {/* Scrim: keeps the copy legible on any photo (bottom on phones, left side above). */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-background from-25% via-background/70 via-50% to-transparent to-75% md:bg-linear-to-r md:from-background/85 md:from-10% md:via-background/40 md:via-45% md:to-transparent md:to-65%"
                />
                <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-4 pt-24 pb-24 md:justify-center md:pb-40 lg:px-6 lg:pt-28">
                  <div className="flex max-w-xl flex-col items-start gap-4 md:gap-6">
                    <p className="eyebrow text-muted-foreground">{slide.eyebrow}</p>
                    <Heading className="text-5xl leading-tight sm:text-6xl lg:text-7xl">
                      {slide.heading}{" "}
                      <span className="block italic text-primary">{slide.headingAccent}</span>
                    </Heading>
                    <p className="max-w-md text-base leading-relaxed text-foreground/80 sm:text-lg">{slide.body}</p>
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

      {/* Badges and controls stay put while the slides move. */}
      {/* Tablet and up only: phones swipe between slides. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 max-md:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-end justify-between px-4 pb-10 lg:px-6">
          <TrustBadges variant="overlay" className="pointer-events-auto" />
          <div className="pointer-events-auto flex items-center rounded-full bg-background/80 p-0.5 backdrop-blur-sm">
            <CarouselPrevious variant="ghost" className="static my-0 bg-transparent backdrop-blur-none" />
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
            <CarouselNext variant="ghost" className="static my-0 bg-transparent backdrop-blur-none" />
            {!reducedMotion && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                className="rounded-full"
              >
                {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Carousel>
  );
}

// Art direction: phones download only the portrait photo, larger screens only the landscape one.
function SlideImage({ slide, eager }: { slide: HeroSlide; eager: boolean }) {
  const common = { alt: slide.imageAlt, fill: true, sizes: "100vw" };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: mediaUrl(slide.image) });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    src: mediaUrl(slide.mobileImage),
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} alt={slide.imageAlt} className={cn("object-cover object-top", slide.imagePosition)} />
    </picture>
  );
}
