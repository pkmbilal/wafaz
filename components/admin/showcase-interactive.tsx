"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

// Interactive primitives for the dev showcase (client-only so they can hold state).
export function InteractiveShowcase() {
  const [range, setRange] = useState([800, 2400]);

  return (
    <>
      <Section title="Accordion">
        <Accordion type="multiple" defaultValue={["a"]} className="max-w-md">
          <AccordionItem value="a">
            <AccordionTrigger>Description</AccordionTrigger>
            <AccordionContent>Soft cotton kurti with block-print detailing.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Care</AccordionTrigger>
            <AccordionContent>Gentle hand wash in cold water.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Checkbox">
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <Checkbox defaultChecked /> Cotton
        </label>
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <Checkbox /> Linen
        </label>
        <label className="flex min-h-touch items-center gap-2 text-sm text-muted-foreground">
          <Checkbox disabled /> Disabled
        </label>
      </Section>

      <Section title="Select">
        <Select defaultValue="featured">
          <SelectTrigger aria-label="Sort by" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <Section title="Slider">
        <div className="w-full max-w-sm px-2">
          <Slider min={0} max={3000} step={100} value={range} onValueChange={setRange} aria-label="Price range" />
          <p className="mt-3 text-sm">
            ₹{range[0]} – ₹{range[1]}
          </p>
        </div>
      </Section>

      <Section title="Dialog / Sheet">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Size chart</DialogTitle>
              <DialogDescription>Measurements in inches.</DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
        {(["left", "right", "bottom"] as const).map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet ({side})</Button>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Sheet from the {side}.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        ))}
      </Section>

      <Section title="Carousel">
        <Carousel className="w-full max-w-sm overflow-hidden rounded-md">
          <CarouselContent className="ml-0">
            {[1, 2, 3].map((n) => (
              <CarouselItem key={n} className="pl-0">
                <div className="flex aspect-4/5 items-center justify-center bg-muted font-heading text-4xl">{n}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}
