"use client";

import { BottomSheet } from "./BottomSheet";
import { PricingItem } from "@/types/pricing";
import { SIMULATED_SCAN_IDS } from "@/lib/mobile";
import { fmt } from "@/lib/format";

type Props = {
  open: boolean;
  items: PricingItem[];
  onClose: () => void;
  onPick: (upc: string) => void;
};

// Mock-scan product sheet — the prototype's stand-in for a real Zebra
// DataWedge trigger (no camera, no hardware dependency). Picking a row
// resolves the SAME UPC path a real scan would (onPick receives the UPC, not
// the item id), so this and the real wedge share one resolver in MobileShell.
export function SimulateScanSheet({ open, items, onClose, onPick }: Props) {
  const options = SIMULATED_SCAN_IDS.map((id) => items.find((i) => i.id === id)).filter(
    (i): i is PricingItem => i != null
  );
  return (
    <BottomSheet open={open} onClose={onClose} title="Simulate scan">
      <ul className="flex flex-col gap-1">
        {options.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onPick(item.upc ?? item.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-gray-50 active:bg-gray-100"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">{item.name}</span>
                <span className="block text-xs text-gray-500">
                  {item.id} · {item.upc}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700">{fmt(item.currentBasePrice)}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
