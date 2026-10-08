import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      <ArrowLeft aria-hidden className="size-4" /> {children}
    </Link>
  );
}

// A titled card for one part of an admin edit screen.
export function AdminSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
