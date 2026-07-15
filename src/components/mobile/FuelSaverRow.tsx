"use client";

import { Fuel, ChevronRight } from "lucide-react";

type Props = {
  value: number | null | undefined;
  onOpen: () => void;
};

// Large dropdown-style row — opens FuelSaverSheet's bottom-sheet list.
// Commits on selection there, so this row is always in its "decided" shape.
export function FuelSaverRow({ value, onOpen }: Props) {
  const label = value && value > 0 ? `+${Math.round(value * 100)}¢` : "None";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Fuel className="size-4 text-gray-400" aria-hidden="true" /> Fuel Saver
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
        {label}
        <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
      </span>
    </button>
  );
}
