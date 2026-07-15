"use client";

import { useEffect, useRef } from "react";

/**
 * Listens for hardware barcode-scanner keystrokes. A Zebra DataWedge trigger
 * emits a burst of digit keystrokes terminated by Enter, faster than any
 * human types — buffer digits, reset the buffer if the gap between
 * keystrokes exceeds 100ms (a person typing, not the wedge), and resolve the
 * full run on Enter.
 *
 * `enabled` must be gated to mobile-only call sites (see useIsMobile) — this
 * attaches a WINDOW-level keydown listener that isn't CSS-scoped, so on
 * desktop it would silently swallow a director's search-box keystrokes if
 * ever mounted there.
 */
export function useBarcodeWedge(onScan: (upc: string) => void, enabled: boolean) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // A focused text input (the UPC-entry fallback keypad has none, but a
      // future text field might) shouldn't feed the wedge buffer.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) bufferRef.current = "";
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const upc = bufferRef.current;
        bufferRef.current = "";
        if (upc.length > 0) onScan(upc);
        return;
      }
      if (/^[0-9]$/.test(e.key)) bufferRef.current += e.key;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onScan]);
}
