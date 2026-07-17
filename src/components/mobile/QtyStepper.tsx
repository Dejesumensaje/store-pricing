"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  qty: number;
  onChange: (qty: number) => void;
  /** Section name for the accessible labels ("retail" / "base") — the two
      steppers coexist on one screen, so their labels must differ. */
  label: string;
};

// Shared multi-unit stepper — Retail and Base render the exact same control
// so "N for $X" reads identically in both sections.
export function QtyStepper({ qty, onChange, label }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Decrease ${label} quantity`}
        onClick={() => onChange(Math.max(1, qty - 1))}
        className="flex size-9.5 select-none touch-manipulation items-center justify-center rounded-full bg-gray-200 text-gray-700 transition-transform duration-75 active:scale-95 active:bg-gray-300 motion-reduce:transition-none"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
      <button
        type="button"
        aria-label={`Increase ${label} quantity`}
        onClick={() => onChange(Math.min(9, qty + 1))}
        className="flex size-9.5 select-none touch-manipulation items-center justify-center rounded-full bg-gray-200 text-gray-700 transition-transform duration-75 active:scale-95 active:bg-gray-300 motion-reduce:transition-none"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
