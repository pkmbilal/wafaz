import { ShieldCheck, Shirt, Truck } from "lucide-react";
import { cn } from "cn";

// TODO(owner): confirm the badge copy, especially the delivery claim.
const badges = [
  { icon: Shirt, label: "Trendy outfits" },
  { icon: Truck, label: "Fast & reliable delivery" },
  { icon: ShieldCheck, label: "Secure checkout" },
];

// `overlay` sits inside the hero under the call to action (tablet and up);
// `band` is a full-width row under the hero for phones, where the photo has no room for it.
export function TrustBadges({ variant, className }: { variant: "overlay" | "band"; className?: string }) {
  if (variant === "overlay") {
    return (
      <ul aria-label="Why shop with us" className={cn("flex divide-x divide-foreground/15", className)}>
        {badges.map(({ icon: Icon, label }) => (
          <li key={label} className="flex max-w-36 flex-col gap-2 px-6 first:pl-0 last:pr-0">
            <Icon aria-hidden strokeWidth={1.25} className="size-7 text-primary" />
            <span className="text-sm leading-snug text-foreground/80">{label}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("border-b", className)}>
      <ul aria-label="Why shop with us" className="mx-auto grid w-full max-w-7xl grid-cols-3 divide-x px-4 lg:px-6">
        {badges.map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col items-center gap-2 px-2 py-6 text-center sm:flex-row sm:justify-center sm:gap-3">
            <Icon aria-hidden strokeWidth={1.25} className="size-6 shrink-0 text-primary" />
            <span className="text-xs leading-snug text-muted-foreground sm:text-sm">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
