"use client";

import { useEffect, useState } from "react";

// Matches the same breakpoint the page's `md:hidden` / `hidden md:flex` split
// uses (Tailwind's `md` = 48rem) — mobile is strictly below it.
const QUERY = "(max-width: 47.999rem)";

/**
 * SSR-safe mobile detection. Starts `false` (no window access during render,
 * so server and first client render agree — no hydration mismatch) and
 * corrects itself in an effect once the real viewport is known. MobileShell
 * gates its entire subtree on this, so every mobile-only hook (the barcode
 * wedge's global keydown listener, the hash/popstate nav listener) is never
 * even mounted on desktop — not just CSS-hidden.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
