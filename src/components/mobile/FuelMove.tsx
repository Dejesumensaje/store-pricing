"use client";

import { Fuel } from "lucide-react";
import { fmt } from "@/lib/format";

// Dollar amounts ("$0.10") — the fuel icon already says what the number is,
// so no "+" prefix.
export const fuelAmountLabel = (v: number | null | undefined) => (v && v > 0 ? fmt(v) : "None");

// Desktop's blue fuel chip (see buildStoreColumns.FuelChip).
export function FuelChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm border border-blue-200 bg-blue-50 px-1 py-px text-[10px] font-bold tabular-nums text-blue-700">
      <Fuel aria-hidden="true" className="size-2.5" />
      {fuelAmountLabel(value)}
    </span>
  );
}

// The fuel counterpart to desktop's MoveLine: "old → chip" when the fuel
// saver changed this session, or the steady live chip alone when it's
// unchanged context riding along on an edited item (mirrors FuelSaverCell).
export function FuelMoveLine({
  label,
  from,
  to,
  changed,
}: {
  label?: string;
  from: number | null;
  to: number | null;
  changed: boolean;
}) {
  if (!changed && !(to && to > 0)) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm tabular-nums">
      {label && <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">{label}</span>}
      {changed && from != null && from > 0 && (
        <>
          <span className="text-xs text-gray-400 line-through">{fuelAmountLabel(from)}</span>
          <span aria-hidden="true" className="text-gray-300">
            →
          </span>
        </>
      )}
      {to && to > 0 ? <FuelChip value={to} /> : <span className="text-gray-500">None</span>}
    </span>
  );
}
