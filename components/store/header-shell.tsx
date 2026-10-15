"use client";

import { useEffect, useRef } from "react";

// The header element. Flags `data-scrolled` once the page moves, so a header sitting over a
// full-bleed hero (the `over-hero` variant) turns solid as soon as the visitor scrolls.
export function HeaderShell({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header ref={ref} className={className}>
      {children}
    </header>
  );
}
