import { MessageCircle } from "lucide-react";

// Floating chat link. Uses the support phone from store settings.
// TODO(owner): confirm the support number is on WhatsApp Business.
export function WhatsAppButton({ phone }: { phone: string | null }) {
  const digits = phone?.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;

  const text = encodeURIComponent("Hi! I have a question about a product.");

  return (
    <a
      href={`https://wa.me/${digits}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full bg-success text-primary-foreground shadow-lifted transition-transform outline-none hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/60 md:bottom-6"
    >
      <MessageCircle aria-hidden className="size-6" />
    </a>
  );
}
