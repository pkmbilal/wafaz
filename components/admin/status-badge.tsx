import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { type StatusTone, statusTone } from "@/lib/orders/labels";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-secondary text-secondary-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-accent/25 text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", toneClasses[statusTone(value)])}>
      {label}
    </Badge>
  );
}
