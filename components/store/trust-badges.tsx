import { ShieldCheck, Shirt, Truck } from "lucide-react";
import { cn } from "cn";

// TODO(owner): confirm the badge copy, especially the delivery claim.
const badges = [
  { icon: Shirt, label: "Trendy outfits" },
  { icon: Truck, label: "Fast & reliable delivery" },
  { icon: ShieldCheck, label: "Secure checkout" },
];

// Shown in the home hero, under the call to action. Kept narrow on phones so the row ends
// before the floating WhatsApp button.
export function TrustBadges({ className }: { className?: string }) {
  return (
    <ul aria-label="Why shop with us" className={cn("flex divide-x divide-foreground/15", className)}>
      {badges.map(({ icon: Icon, label }) => (
        <li key={label} className="flex max-w-24 flex-col gap-1.5 px-3 first:pl-0 last:pr-0 md:max-w-36 md:gap-2 md:px-6">
          <Icon aria-hidden strokeWidth={1.25} className="size-6 text-primary md:size-7" />
          <span className="text-xs leading-snug text-foreground/80 md:text-sm">{label}</span>
        </li>
      ))}
    </ul>
  );
}
