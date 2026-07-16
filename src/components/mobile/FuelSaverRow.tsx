"use client";

import { Fuel, ChevronRight } from "lucide-react";
import { fuelAmountLabel } from "./FuelMove";

type Props = {
  value: number | null | undefined;
  onOpen: () => void;
};

// Large dropdown-style row — opens FuelSaverSheet's bottom-sheet list
// (multiples of 10¢). Commits on selection there, so this row is always in
// its "decided" shape. Monochrome like its siblings: the fuel icon + label
// carry the identity in black and white.
export function FuelSaverRow({ value, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 w-full select-none touch-manipulation items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left"
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
        <Fuel className="size-4 text-gray-400" aria-hidden="true" /> Fuel Saver
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
        {fuelAmountLabel(value)}
        <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
      </span>
    </button>
  );
}
