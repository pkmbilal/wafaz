import Link from "next/link";
import { STORE_NAME } from "@/lib/site";
import type { NavCategory } from "@/lib/catalog/queries";

type Settings = {
  legal_name: string | null;
  trade_name: string | null;
  gstin: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  support_email: string | null;
  support_phone: string | null;
};

const POLICY_LINKS = [
  { label: "About us", href: "/pages/about" },
  { label: "Contact us", href: "/pages/contact" },
  { label: "Privacy policy", href: "/pages/privacy-policy" },
  { label: "Terms & conditions", href: "/pages/terms" },
  { label: "Shipping policy", href: "/pages/shipping-policy" },
  { label: "Return & refund policy", href: "/pages/return-refund-policy" },
  { label: "Grievance officer", href: "/pages/grievance-officer" },
];

// Seller details are required on every page by the Consumer Protection (E-Commerce) Rules 2020.
export function Footer({ settings, categories }: { settings: Settings; categories: NavCategory[] }) {
  const address = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.state].filter(Boolean).join(", "),
    settings.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <footer className="mt-24 bg-ink text-sm text-ink-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-3xl font-medium tracking-[0.14em] uppercase">{STORE_NAME}</p>
          <span aria-hidden className="h-px w-12 bg-accent" />
          <p className="max-w-xs leading-relaxed text-ink-foreground/65">
            Indian ethnic wear — kurtis, sets, co-ords and kaftans — shipped across India.
          </p>
        </div>

        <FooterColumn title="Shop">
          <FooterLink href="/collections/new-arrivals">New Arrivals</FooterLink>
          <FooterLink href="/collections/best-sellers">Best Sellers</FooterLink>
          {categories.map((c) => (
            <FooterLink key={c.slug} href={`/collections/${c.slug}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Help">
          {POLICY_LINKS.map((l) => (
            <FooterLink key={l.href} href={l.href}>
              {l.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <div className="flex flex-col gap-2">
          <h2 className="mb-2 eyebrow text-accent">Seller</h2>
          <address className="flex flex-col gap-1 leading-relaxed text-ink-foreground/65 not-italic">
            <span className="font-medium text-ink-foreground">{settings.legal_name}</span>
            {address && <span>{address}</span>}
            {settings.gstin && <span>GSTIN: {settings.gstin}</span>}
            {settings.support_phone && (
              <a href={`tel:${settings.support_phone}`} className="underline-offset-4 hover:underline">
                {settings.support_phone}
              </a>
            )}
            {settings.support_email && (
              <a href={`mailto:${settings.support_email}`} className="underline-offset-4 hover:underline">
                {settings.support_email}
              </a>
            )}
          </address>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs tracking-wide text-ink-foreground/50 lg:px-6">
          © {settings.legal_name ?? settings.trade_name}. Prices include GST.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-2 eyebrow text-accent">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center text-ink-foreground/65 underline-offset-4 outline-none hover:text-ink-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        {children}
      </Link>
    </li>
  );
}
