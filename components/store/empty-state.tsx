import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 bg-secondary px-6 py-20 text-center", className)}>
      <Icon aria-hidden className="size-10 text-accent" strokeWidth={1.5} />
      <h2 className="text-3xl">{title}</h2>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && (
        <Button asChild variant="outline" className="mt-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
