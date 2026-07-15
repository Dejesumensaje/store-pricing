"use client";

import { Fuel, ChevronRight } from "lucide-react";
import { fuelAmountLabel } from "./FuelMove";

type Props = {
  value: number | null | undefined;
  onOpen: () => void;
  /** Meta chip row (run window + reason) rendered inside the card, below the
      selector row — present once the fuel saver carries a value. */
  meta?: React.ReactNode;
};

// Large dropdown-style row — opens FuelSaverSheet's bottom-sheet list.
// Commits on selection there, so this row is always in its "decided" shape.
// Blue identity matching the desktop fuel chip, so the three levers (yellow
// retail / white base / blue fuel) read apart at a glance.
export function FuelSaverRow({ value, onOpen, meta }: Props) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 w-full select-none touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <Fuel className="size-4 text-blue-500" aria-hidden="true" /> Fuel Saver
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-blue-800">
          {fuelAmountLabel(value)}
          <ChevronRight className="size-4 text-blue-400" aria-hidden="true" />
        </span>
      </button>
      {meta && <div className="flex flex-wrap gap-2 px-3 pb-3">{meta}</div>}
    </div>
  );
}
