import Link from "next/link";
import { Search, User } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/store/cart-button";
import { HeaderShell } from "@/components/store/header-shell";
import { LinkPending } from "@/components/store/link-pending";
import { MobileMenu } from "@/components/store/mobile-menu";
import type { NavCategory } from "@/lib/catalog/queries";
import { STORE_NAME } from "@/lib/site";

export function Header({ categories }: { categories: NavCategory[] }) {
  return (
    <HeaderShell
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur transition-colors duration-300 supports-backdrop-filter:bg-background/85",
        // Transparent over a full-bleed hero until the page scrolls.
        "over-hero:not-data-scrolled:border-transparent over-hero:not-data-scrolled:bg-transparent over-hero:not-data-scrolled:backdrop-blur-none over-hero:not-data-scrolled:supports-backdrop-filter:bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 lg:h-20 lg:px-6">
        <MobileMenu categories={categories} />

        <Link
          href="/"
          className="font-heading text-2xl leading-none font-medium tracking-[0.14em] text-foreground uppercase max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2 lg:text-3xl"
        >
          {STORE_NAME}
        </Link>

        <nav aria-label="Main" className="ml-12 hidden lg:block">
          <ul className="flex items-center gap-2">
            <li>
              <NavLink href="/shop">Shop all</NavLink>
            </li>
            <li>
              <NavLink href="/collections/new-arrivals">New Arrivals</NavLink>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <NavLink href={`/collections/${c.slug}`}>{c.name}</NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center">
          <Button asChild variant="ghost" size="icon">
            <Link href="/search" aria-label="Search">
              <Search />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="max-md:hidden">
            {/* No prefetch: /account redirects server-side, and a prefetched copy leaves the click stuck. */}
            <Link href="/account" prefetch={false} aria-label="Account">
              <LinkPending>
                <User />
              </LinkPending>
            </Link>
          </Button>
          <CartButton />
        </div>
      </div>
    </HeaderShell>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch items-center rounded-md px-3 eyebrow text-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      <span className="link-underline">{children}</span>
    </Link>
  );
}
