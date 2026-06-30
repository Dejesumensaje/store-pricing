"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { X, ScanLine, Check } from "lucide-react";
import { PricingItem } from "@/types/pricing";

type Props = {
  open: boolean;
  items: PricingItem[];
  onClose: () => void;
  onScanResult: (itemId: string) => void;
};

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Simulated barcode scanner for the mobile demo: no camera, no dependency.
// Shows an animated viewfinder; "detecting" resolves to a real catalog item and
// opens its edit drawer. Swapping in a real camera (@zxing/browser decoding
// getUserMedia) means replacing only the resolve step — onScanResult is unchanged.
export function ScanOverlay({ open, items, onClose, onScanResult }: Props) {
  const [detected, setDetected] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Element to restore focus to when the overlay closes (the "Scan" trigger).
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, [open]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  if (!open) return null;

  // Escape to close; Tab wraps within the overlay (basic focus trap).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const simulateScan = () => {
    if (detected || items.length === 0) return;
    const item = items[Math.floor(Math.random() * items.length)];
    setDetected(true);
    // Brief "locked on" beat before jumping into the drawer.
    timeoutRef.current = setTimeout(() => {
      setDetected(false);
      onScanResult(item.id);
    }, 550);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Simulated barcode scanner"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white"
    >
      <div className="flex items-center justify-between p-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <ScanLine className="size-4" aria-hidden="true" /> Scan product
        </span>
        <button ref={closeRef} onClick={onClose} aria-label="Close scanner" className="rounded-full p-1.5 hover:bg-white/10">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
        <button
          onClick={simulateScan}
          aria-label="Simulate scan"
          className="relative size-64 max-w-[80vw] overflow-hidden rounded-2xl border border-white/20 bg-white/5"
        >
          {/* corner brackets */}
          <span aria-hidden="true" className="absolute left-3 top-3 size-7 rounded-tl-lg border-l-2 border-t-2 border-white/80" />
          <span aria-hidden="true" className="absolute right-3 top-3 size-7 rounded-tr-lg border-r-2 border-t-2 border-white/80" />
          <span aria-hidden="true" className="absolute bottom-3 left-3 size-7 rounded-bl-lg border-b-2 border-l-2 border-white/80" />
          <span aria-hidden="true" className="absolute bottom-3 right-3 size-7 rounded-br-lg border-b-2 border-r-2 border-white/80" />

          {detected ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-500/20">
              <Check className="size-12 text-emerald-300" aria-hidden="true" />
              <span className="text-sm font-medium text-emerald-100">Found it</span>
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="scan-line absolute inset-x-6 h-0.5 bg-brand shadow-[0_0_12px_2px] shadow-brand"
            />
          )}
        </button>

        <div className="text-center">
          <p className="text-sm text-white/80">Simulated scan — tap the frame</p>
        </div>

        <Button variant="primary" iconLeft={ScanLine} onClick={simulateScan}>
          Simulate scan
        </Button>
      </div>
    </div>
  );
}
