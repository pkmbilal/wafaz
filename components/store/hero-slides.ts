// Home hero content: one slide per dress type. Static on purpose; edit this file to change the hero.
// TODO(owner): final copy, and the store's own hero photos in place of the demo placeholders:
// desktop landscape ~2400x1350 (16:9) with the model in the right third and a plain, light left side
// for the text (like the reference design); mobile portrait 4:5 with the model top-centre.

export type HeroSlide = {
  id: string;
  eyebrow: string;
  heading: string;
  /** Second headline line, shown in italics in the brand colour. */
  headingAccent: string;
  body: string;
  cta: string;
  href: string;
  /** Landscape photo for tablet and desktop; the text sits over its left side. */
  image: string;
  /** Portrait photo for phones. */
  mobileImage: string;
  /** Focal point of the desktop photo, as a full `md:` Tailwind class so the build picks it up. */
  imagePosition: string;
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
    image: "seed/banner-02.webp",
    mobileImage: "seed/placeholder-01.webp",
    imagePosition: "md:object-[70%_30%]",
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
    image: "seed/placeholder-02.webp",
    mobileImage: "seed/placeholder-02.webp",
    imagePosition: "md:object-[50%_20%]",
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
    image: "seed/placeholder-03.webp",
    mobileImage: "seed/placeholder-03.webp",
    imagePosition: "md:object-[50%_20%]",
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
    image: "seed/placeholder-04.webp",
    mobileImage: "seed/placeholder-04.webp",
    imagePosition: "md:object-[50%_20%]",
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
    image: "seed/placeholder-05.webp",
    mobileImage: "seed/placeholder-05.webp",
    imagePosition: "md:object-[50%_20%]",
    imageAlt: "Model wearing a dupatta",
  },
];
