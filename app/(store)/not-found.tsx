import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/store/empty-state";

export default function StoreNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that page"
        description="It may have moved or is no longer available."
        action={{ label: "Browse new arrivals", href: "/collections/new-arrivals" }}
      />
    </div>
  );
}
