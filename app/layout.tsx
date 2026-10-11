import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { publicEnv } from "@/lib/env";
import { STORE_NAME, STORE_TAGLINE } from "@/lib/site";
import "./globals.css";

// TODO(owner): confirm fonts. Swap the display serif / body sans here; the CSS
// variables (--font-display, --font-body) keep the rest of the app unchanged.
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const body = Jost({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// TODO(owner): default description.
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${STORE_NAME} — ${STORE_TAGLINE}`,
    template: `%s | ${STORE_NAME}`,
  },
  description: "Kurtis, kurti sets, co-ords and kaftans, shipped across India.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff", // matches --background; meta tags need a literal colour
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
