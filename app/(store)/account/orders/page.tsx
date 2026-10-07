import type { Metadata } from "next";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/store/empty-state";

export const metadata: Metadata = { title: "My orders" };

// TODO(M6): order history and detail once orders exist.
export default function AccountOrdersPage() {
  return (
    <EmptyState
      icon={Package}
      title="No orders yet"
      description="When you place an order, you'll be able to track it here."
      action={{ label: "Start shopping", href: "/collections/new-arrivals" }}
    />
  );
}
