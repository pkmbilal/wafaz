import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { type StatusTone, statusTone } from "@/lib/orders/labels";

// TailAdmin-style pill: soft tint of the status colour, sentence case.

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-ink/8 text-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-accent/20 text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto rounded-full border-transparent px-2.5 py-0.5 text-xs font-medium tracking-normal normal-case",
        toneClasses[statusTone(value)],
      )}
    >
      {label}
    </Badge>
  );
}
