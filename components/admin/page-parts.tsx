import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Building blocks for admin screens, after TailAdmin's page layout: a title row with breadcrumbs,
// and white cards on the grey canvas.

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

export type Crumb = { label: string; href?: string };

// Page title on the left, breadcrumbs (Dashboard › …) on the right. `meta` sits under the title
// (badges, dates); `actions` holds the page's main buttons.
export function PageHeader({
  title,
  crumbs = [],
  meta,
  actions,
}: {
  title: React.ReactNode;
  crumbs?: Crumb[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const trail: Crumb[] = [{ label: "Dashboard", href: "/admin" }, ...crumbs];
  const current = typeof title === "string" ? title : undefined;
  // The dashboard is the root, so it shows no trail of its own.
  const showCrumbs = crumbs.length > 0 || current !== "Dashboard";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-3xl leading-tight font-medium sm:text-4xl">{title}</h1>
        {meta && <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {(showCrumbs || actions) && (
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          {showCrumbs && (
            <Breadcrumb>
              <BreadcrumbList className="text-sm tracking-normal">
                {trail.map((c, i) => (
                  <Fragment key={`${c.label}-${i}`}>
                    <BreadcrumbItem>
                      {c.href ? (
                        <BreadcrumbLink asChild>
                          <Link href={c.href} className="inline-flex min-h-touch items-center">
                            {c.label}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <span>{c.label}</span>
                      )}
                    </BreadcrumbItem>
                    {(current || i < trail.length - 1) && <BreadcrumbSeparator />}
                  </Fragment>
                ))}
                {current && (
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-primary">{current}</BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}

// A white card on the admin canvas. `flush` drops the body padding so a table can run edge to edge.
export function AdminCard({
  id,
  title,
  description,
  actions,
  footer,
  flush = false,
  className,
  children,
}: {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  const hasHeader = title !== undefined || actions !== undefined;
  const Root = title !== undefined && headingId ? "section" : "div";

  return (
    <Root
      data-slot="admin-card"
      aria-labelledby={Root === "section" ? headingId : undefined}
      className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-soft", className)}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          {title !== undefined && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={headingId} className="font-sans text-lg font-medium tracking-normal">
                {title}
              </h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", !flush && "gap-4 p-5 sm:p-6")}>{children}</div>
      {footer && <div className="border-t border-border px-5 py-3 sm:px-6">{footer}</div>}
    </Root>
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
    <AdminCard id={id} title={title} description={description}>
      {children}
    </AdminCard>
  );
}
