import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

// TODO(owner): placeholder fonts. Swap the display serif / body sans here; the CSS
// variables (--font-display, --font-body) keep the rest of the app unchanged.
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// TODO(owner): store name and default description.
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Wafaz — Indian Ethnic Wear",
    template: "%s | Wafaz",
  },
  description: "Kurtis, kurti sets, co-ords and kaftans, shipped across India.",
};

export const viewport: Viewport = {
  themeColor: "#fbf8f2", // matches --background; meta tags need a literal colour
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
