"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { FUEL_SAVER_OPTIONS } from "@/lib/pricing-meta";
import { fuelAmountLabel } from "./FuelMove";

type Props = {
  open: boolean;
  value: number | null | undefined;
  onClose: () => void;
  onSelect: (value: number | null) => void;
};

// Reuses desktop's shared FUEL_SAVER_OPTIONS catalog, rendered in dollars
// ("+$0.10"…) — the same vocabulary as the desktop fuel chip. Selecting an
// option commits immediately (no separate Save step) — Fuel Saver carries no
// Override record, so there's nothing to stage.
export function FuelSaverSheet({ open, value, onClose, onSelect }: Props) {
  const current = (value ?? 0).toFixed(2);
  return (
    <BottomSheet open={open} onClose={onClose} title="Fuel Saver">
      <ul className="flex flex-col gap-1">
        {FUEL_SAVER_OPTIONS.map((opt) => {
          const amount = Number(opt.value);
          const label = fuelAmountLabel(amount);
          const selected = opt.value === current;
          return (
            <li key={opt.value}>
              <button
                onClick={() => {
                  onSelect(amount > 0 ? amount : null);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100"
              >
                {label}
                {selected && <Check className="size-4 text-brand" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
