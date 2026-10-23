import { dtdcTrackingUrl } from "@/lib/shipping/dtdc";
import { indiaPostTrackingUrl } from "@/lib/shipping/indiapost";

// Couriers the owner books with (shipments.courier). The tracking link per courier is shown on the
// order page and in the shipped email.

export const COURIERS = ["dtdc", "india_post", "other"] as const;
export type Courier = (typeof COURIERS)[number];

export const courierLabels: Record<Courier, string> = {
  dtdc: "DTDC",
  india_post: "India Post",
  other: "Courier",
};

// Null when the courier has no public tracking page we know of. No courier supports a reliable deep link
// to a consignment, so the tracking number is shown next to the link for the customer to paste.
export function trackingUrl(courier: Courier): string | null {
  switch (courier) {
    case "dtdc":
      return dtdcTrackingUrl();
    case "india_post":
      return indiaPostTrackingUrl();
    case "other":
      return null;
  }
}

export function isCourier(value: string): value is Courier {
  return (COURIERS as readonly string[]).includes(value);
}
