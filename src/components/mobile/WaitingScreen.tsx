"use client";

import { ChevronLeft, ScanBarcode } from "lucide-react";
import { Badge, Button } from "@dejesumensaje/converge-ds-experimental";

type Props = {
  mode: "walk" | "maint";
  sessionCount?: number;
  onOpenTray?: () => void;
  onSimulateScan: () => void;
  onEnterUpc: () => void;
  onHome: () => void;
  unknownUpc?: string | null;
};

// Both modes' idle state — big glanceable "Waiting for barcode…" so a
// director can tell at a glance the device is ready, without reading text.
// No in-app Scan button here or anywhere else in the mobile shell: the
// primary path is the hardware side trigger (real DataWedge keystrokes
// resolve via useBarcodeWedge); "Simulate scan" / "Enter UPC" below are the
// prototype's stand-ins for it.
export function WaitingScreen({ mode, sessionCount, onOpenTray, onSimulateScan, onEnterUpc, onHome, unknownUpc }: Props) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* flex-1 side slots keep the title centered while both affordances
          grow to real touch targets (min-h-11 ≈ 44px). */}
      <div className="flex items-center border-b border-gray-100 px-2 py-1.5">
        <div className="flex flex-1 justify-start">
          <button
            onClick={onHome}
            className="-ml-1 flex min-h-11 select-none touch-manipulation items-center gap-0.5 rounded-lg pl-1 pr-2.5 text-sm font-medium text-gray-500 active:bg-gray-100"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            Home
          </button>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">
          {mode === "walk" ? "Store Walk" : "Item Maintenance"}
        </span>
        <div className="flex flex-1 justify-end">
          {mode === "walk" ? (
            /* Labeled, not a bare number — "N edited" is the same vocabulary
               the desktop store switcher uses for pending walk work, so the
               count can't read as decoration. Opens the session tray. */
            <button
              onClick={onOpenTray}
              aria-label={`Session tray, ${sessionCount ?? 0} edited this walk`}
              className="-mr-1 flex min-h-11 select-none touch-manipulation items-center rounded-lg px-1.5 active:bg-gray-100"
            >
              <Badge tone={sessionCount ? "in-progress" : "neutral"}>{sessionCount ?? 0} edited</Badge>
            </button>
          ) : (
            <span className="w-10" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="relative flex size-24 items-center justify-center rounded-full bg-brand/10">
          <span aria-hidden="true" className="waiting-pulse absolute inset-0 rounded-full bg-brand/20" />
          <ScanBarcode className="size-10 text-brand" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-semibold text-gray-900">Waiting for barcode…</p>
          <p className="mt-1 text-sm text-gray-500">Use the side trigger</p>
        </div>
        {unknownUpc && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No item found for UPC {unknownUpc}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" onClick={onSimulateScan} className="h-12 w-full">
          Simulate scan
        </Button>
        <Button variant="tertiary" onClick={onEnterUpc} className="h-12 w-full">
          Enter UPC
        </Button>
      </div>
    </div>
  );
}
