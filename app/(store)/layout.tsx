import { AnnouncementBar } from "@/components/store/announcement-bar";
import { CartProvider } from "@/components/store/cart-provider";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { MobileBottomNav } from "@/components/store/mobile-bottom-nav";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { Toaster } from "@/components/ui/sonner";
import { getNavCategories, getStoreSettings } from "@/lib/catalog/queries";

// Storefront chrome. Everything here is cached catalog data: no session reads.
// CartProvider loads the cart from the browser, only when a session already exists.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getNavCategories(), getStoreSettings()]);

  return (
    <CartProvider>
      <div className="flex min-h-full flex-1 flex-col pb-16 md:pb-0">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <AnnouncementBar />
        <Header categories={categories} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} categories={categories} />
        <WhatsAppButton phone={settings.support_phone} />
        <MobileBottomNav />
        <Toaster />
      </div>
    </CartProvider>
  );
}
