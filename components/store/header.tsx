import Link from "next/link";
import { Search, ShoppingBag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/store/mobile-menu";
import type { NavCategory } from "@/lib/catalog/queries";
import { STORE_NAME } from "@/lib/site";

export function Header({ categories }: { categories: NavCategory[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 lg:px-6">
        <MobileMenu categories={categories} />

        <Link
          href="/"
          className="font-heading text-3xl leading-none font-semibold tracking-tight text-primary max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2"
        >
          {STORE_NAME}
        </Link>

        <nav aria-label="Main" className="ml-10 hidden lg:block">
          <ul className="flex items-center gap-1">
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
            <Link href="/account" aria-label="Account">
              <User />
            </Link>
          </Button>
          {/* TODO(M5): open the CartDrawer and show the item count. */}
          <Button asChild variant="ghost" size="icon">
            <Link href="/cart" aria-label="Cart">
              <ShoppingBag />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch items-center rounded-md px-3 text-sm font-medium tracking-wide text-foreground/80 transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      {children}
    </Link>
  );
}
