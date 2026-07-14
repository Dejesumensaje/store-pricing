"use client";

import { useState } from "react";
import { ReductionInput } from "./ReductionInput";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { OverrideStatus } from "@/types/pricing";
import { fmt } from "@/lib/format";

// The ways a director can set a permanent base (white-tag) price. Mirrors the
// temporary-allowance retail chooser (pick the *kind* of change first, then the
// number) so the two price decisions feel the same — but without "Multi-unit"
// (a base price is a single shelf price, not a deal).
type Method = "pct" | "amount" | "exact";

const METHODS: { id: Method; label: string }[] = [
  { id: "pct", label: "% off" },
  { id: "amount", label: "$ off" },
  { id: "exact", label: "Exact price" },
];

// Progressive base-price control. % / $ off are computed off the current base
// price; "Exact price" takes a price directly. Only the chosen input is mounted.
export function BaseReductionField({
  reference,
  recommended,
  value,
  status,
  hasAlert,
  overEdlpMax,
  onCommit,
  ariaLabel = "New base price",
}: {
  /** Current base (white-tag) price the % / $ reduction is computed off. */
  reference: number;
  /** Ghost placeholder for the exact input (e.g. HQ's recommended price). */
  recommended: number | null;
  value: number | null;
  status?: OverrideStatus;
  hasAlert?: boolean;
  /** The committed price is over the item's EDLP maximum (soft or exception-covered). */
  overEdlpMax?: boolean;
  onCommit: (price: number | null) => void;
  ariaLabel?: string;
}) {
  // Open on "Exact price" — a base price is most naturally set by typing the new
  // shelf price; % / $ off are there for directors who think in reductions.
  const [method, setMethod] = useState<Method>("exact");
  const state = derivePriceState({ value, status, hasAlert, overEdlpMax });

  return (
    <div className="flex flex-col gap-3">
      {/* How do you want to mark it down? — one path at a time. */}
      <div className="flex w-fit overflow-hidden rounded-lg border border-gray-300">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            aria-pressed={method === m.id}
            className={`border-l border-gray-300 px-3 py-1.5 text-sm font-medium first:border-l-0 ${
              method === m.id ? "bg-brand text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {(method === "pct" || method === "amount") && (
        <div className="flex flex-col gap-1">
          <ReductionInput
            reference={reference}
            value={value}
            mode={method}
            hideToggle
            onCommit={onCommit}
          />
          {value != null && (
            <p className="text-xs tabular-nums text-gray-500">
              {method === "pct"
                ? `${Math.max(0, Math.round((1 - value / reference) * 100))}% off ${fmt(reference)}`
                : `${fmt(Math.max(0, reference - value))} off ${fmt(reference)}`}
              {" = "}
              <span className="font-medium text-gray-700">{fmt(value)}</span>
            </p>
          )}
        </div>
      )}

      {method === "exact" && (
        <PriceInputCell
          autoFocus
          ariaLabel={ariaLabel}
          recommended={recommended ?? reference}
          value={value}
          state={state}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
