"use client";

import { useState } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { MobileKeypad } from "./MobileKeypad";

type Props = {
  onSubmit: (upc: string) => void;
  onCancel: () => void;
};

// UPC fallback via keypad — for a barcode too worn/dirty to scan. Same
// resolver as the real wedge and Simulate scan (see MobileShell.resolveScan).
export function UpcEntryScreen({ onSubmit, onCancel }: Props) {
  const [digits, setDigits] = useState("");
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button onClick={onCancel} className="text-sm font-medium text-gray-500">
          Cancel
        </button>
        <span className="text-sm font-semibold text-gray-900">Enter UPC</span>
        <span className="w-14" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="w-full">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">UPC</p>
          {/* Framed field (mirrors the Retail readout) so it reads as an input
              target rather than a stray character floating in whitespace. */}
          <div className="mt-2 flex min-h-14 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 px-4">
            {digits ? (
              <span className="text-2xl font-semibold tabular-nums text-gray-900">{digits}</span>
            ) : (
              <span className="text-sm text-gray-400">Enter the barcode number</span>
            )}
          </div>
        </div>
        <Button variant="primary" disabled={digits.length === 0} onClick={() => onSubmit(digits)} className="h-12 w-full">
          Look up
        </Button>
      </div>
      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        <MobileKeypad onDigit={(d) => setDigits((s) => (s.length >= 14 ? s : s + d))} onBackspace={() => setDigits((s) => s.slice(0, -1))} />
      </div>
    </div>
  );
}
