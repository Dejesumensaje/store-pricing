"use client";

import { useState } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { X, ScanLine, Check } from "lucide-react";
import { PricingItem } from "@/types/pricing";

type Props = {
  open: boolean;
  items: PricingItem[];
  onClose: () => void;
  onScanResult: (itemId: string) => void;
};

// Simulated barcode scanner for the mobile demo: no camera, no dependency.
// Shows an animated viewfinder; "detecting" resolves to a real catalog item and
// opens its edit drawer. Swapping in a real camera (@zxing/browser decoding
// getUserMedia) means replacing only the resolve step — onScanResult is unchanged.
export function ScanOverlay({ open, items, onClose, onScanResult }: Props) {
  const [detected, setDetected] = useState(false);

  if (!open) return null;

  const simulateScan = () => {
    if (detected || items.length === 0) return;
    const item = items[Math.floor(Math.random() * items.length)];
    setDetected(true);
    // Brief "locked on" beat before jumping into the drawer.
    setTimeout(() => {
      setDetected(false);
      onScanResult(item.id);
    }, 550);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white">
      <style>{`@keyframes scanline{0%{top:8%}50%{top:88%}100%{top:8%}}`}</style>

      <div className="flex items-center justify-between p-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <ScanLine className="size-4" /> Scan product
        </span>
        <button onClick={onClose} aria-label="Close scanner" className="rounded-full p-1.5 hover:bg-white/10">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
        <button
          onClick={simulateScan}
          aria-label="Simulate scan"
          className="relative size-64 max-w-[80vw] overflow-hidden rounded-2xl border border-white/20 bg-white/5"
        >
          {/* corner brackets */}
          <span className="absolute left-3 top-3 size-7 rounded-tl-lg border-l-2 border-t-2 border-white/80" />
          <span className="absolute right-3 top-3 size-7 rounded-tr-lg border-r-2 border-t-2 border-white/80" />
          <span className="absolute bottom-3 left-3 size-7 rounded-bl-lg border-b-2 border-l-2 border-white/80" />
          <span className="absolute bottom-3 right-3 size-7 rounded-br-lg border-b-2 border-r-2 border-white/80" />

          {detected ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-500/20">
              <Check className="size-12 text-emerald-300" />
              <span className="text-sm font-medium text-emerald-100">Found it</span>
            </span>
          ) : (
            <span
              className="absolute inset-x-6 h-0.5 bg-brand shadow-[0_0_12px_2px] shadow-brand"
              style={{ animation: "scanline 2s ease-in-out infinite" }}
            />
          )}
        </button>

        <div className="text-center">
          <p className="text-sm text-white/80">Point at the product barcode</p>
          <p className="mt-1 text-xs text-white/40">Tap the frame to simulate a scan</p>
        </div>

        <Button variant="primary" iconLeft={ScanLine} onClick={simulateScan}>
          Simulate scan
        </Button>
      </div>
    </div>
  );
}
