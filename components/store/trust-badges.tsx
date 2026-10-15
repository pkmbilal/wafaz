import { ShieldCheck, Shirt, Truck } from "lucide-react";
import { cn } from "cn";

// TODO(owner): confirm the badge copy, especially the delivery claim.
const badges = [
  { icon: Shirt, label: "Trendy outfits", short: "Trendy outfits" },
  { icon: Truck, label: "Fast & reliable delivery", short: "Fast delivery" },
  { icon: ShieldCheck, label: "Secure checkout", short: "Secure checkout" },
];

// Shown in the home hero, under the call to action. On phones it's a compact row (small icon beside
// a two-word label, one word per line) that ends before the floating WhatsApp button.
export function TrustBadges({ className }: { className?: string }) {
  return (
    <ul aria-label="Why shop with us" className={cn("flex divide-x divide-foreground/15", className)}>
      {badges.map(({ icon: Icon, label, short }) => (
        <li
          key={label}
          className="flex items-center gap-1.5 px-2.5 first:pl-0 last:pr-0 md:max-w-36 md:flex-col md:items-start md:gap-2 md:px-6"
        >
          <Icon aria-hidden strokeWidth={1.25} className="size-4 shrink-0 text-primary md:size-7" />
          <span className="w-min text-xs leading-tight text-foreground/80 md:hidden">{short}</span>
          <span className="text-sm leading-snug text-foreground/80 max-md:hidden">{label}</span>
        </li>
      ))}
    </ul>
  );
}
