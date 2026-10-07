import type { Metadata } from "next";

// Admin routes are always dynamic and block on the server (see the guard in (protected)/layout.tsx).
export const instant = false;

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Role checks live in app/admin/(protected)/layout.tsx. The dev-only showcase sits outside it.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
