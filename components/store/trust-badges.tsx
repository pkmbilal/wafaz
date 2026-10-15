import { ShieldCheck, Shirt, Truck } from "lucide-react";

// TODO(owner): confirm the badge copy, especially the delivery claim.
const badges = [
  { icon: Shirt, label: "Trendy outfits" },
  { icon: Truck, label: "Fast & reliable delivery" },
  { icon: ShieldCheck, label: "Secure checkout" },
];

export function TrustBadges() {
  return (
    <div className="border-b">
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
