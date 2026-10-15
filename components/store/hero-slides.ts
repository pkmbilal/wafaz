// Home hero content: one slide per dress type. Static on purpose; edit this file to change the hero.
// TODO(owner): final copy, and the store's own hero photos (portrait 4:5, subject centred or to the top)
// in place of the demo placeholders.

export type HeroSlide = {
  id: string;
  eyebrow: string;
  heading: string;
  /** Second headline line, shown in italics in the brand colour. */
  headingAccent: string;
  body: string;
  cta: string;
  href: string;
  imageKey: string;
  imageAlt: string;
};

export const heroSlides: HeroSlide[] = [
  {
    id: "kurtis",
    eyebrow: "Style / Elegance / You",
    heading: "Modern Styles",
    headingAccent: "for Confident You",
    body: "Everyday kurtis in breathable fabrics, cut to move with you from morning to evening.",
    cta: "Shop kurtis",
    href: "/collections/kurtis",
    imageKey: "seed/placeholder-01.webp",
    imageAlt: "Model wearing a kurti",
  },
  {
    id: "kurti-sets",
    eyebrow: "Ready to wear",
    heading: "Perfectly Paired",
    headingAccent: "Sets for Every Day",
    body: "Kurti, bottom and dupatta, matched for you. One pick, a complete look.",
    cta: "Shop kurti sets",
    href: "/collections/kurti-sets",
    imageKey: "seed/placeholder-02.webp",
    imageAlt: "Model wearing a kurti set",
  },
  {
    id: "co-ords",
    eyebrow: "Easy / Polished",
    heading: "Coordinated",
    headingAccent: "Made Effortless",
    body: "Relaxed co-ord sets that look put-together with no styling needed.",
    cta: "Shop co-ords",
    href: "/collections/co-ords",
    imageKey: "seed/placeholder-03.webp",
    imageAlt: "Model wearing a co-ord set",
  },
  {
    id: "kaftans",
    eyebrow: "Light / Breezy",
    heading: "Flowing Kaftans",
    headingAccent: "for Slow Days",
    body: "Airy silhouettes for lounging, travel and warm afternoons.",
    cta: "Shop kaftans",
    href: "/collections/kaftans",
    imageKey: "seed/placeholder-04.webp",
    imageAlt: "Model wearing a kaftan",
  },
  {
    id: "dupattas",
    eyebrow: "The finishing touch",
    heading: "Drape It",
    headingAccent: "Your Way",
    body: "Soft dupattas in prints and solids to lift any outfit.",
    cta: "Shop dupattas",
    href: "/collections/dupattas",
    imageKey: "seed/placeholder-05.webp",
    imageAlt: "Model wearing a dupatta",
  },
];
