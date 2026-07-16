"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { MOBILE_FUEL_VALUES } from "@/lib/mobile";
import { fuelAmountLabel } from "./FuelMove";

type Props = {
  open: boolean;
  value: number | null | undefined;
  onClose: () => void;
  onSelect: (value: number | null) => void;
};

// Mobile catalog: None + multiples of 10¢ up to $1.00, in dollars ("$0.10"…).
// Selecting an option commits immediately (no separate Save step) — Fuel
// Saver carries no Override record, so there's nothing to stage.
export function FuelSaverSheet({ open, value, onClose, onSelect }: Props) {
  const current = value ?? 0;
  const options = [null, ...MOBILE_FUEL_VALUES];
  return (
    <BottomSheet open={open} onClose={onClose} title="Fuel Saver">
      <ul className="flex flex-col gap-1">
        {options.map((amount) => {
          const selected = Math.abs((amount ?? 0) - current) < 0.001;
          return (
            <li key={amount ?? "none"}>
              <button
                onClick={() => {
                  onSelect(amount);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100"
              >
                {fuelAmountLabel(amount)}
                {selected && <Check className="size-4 text-brand" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
