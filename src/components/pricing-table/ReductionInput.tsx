"use client";

import { useState, useEffect } from "react";

type Mode = "amount" | "pct";

// The reduction (in $ or %) implied by a committed price relative to its
// reference. Empty string when there is no committed price.
function reductionFor(mode: Mode, reference: number, value: number | null): string {
  if (value == null || reference <= 0) return "";
  if (mode === "amount") return (Math.round((reference - value) * 100) / 100).toString();
  return Math.max(0, Math.round((1 - value / reference) * 100)).toString();
}

// Reduction off a reference price, in dollars ($) or percent (%). Computes the
// resulting price so the user doesn't do the math. Commits on blur/Enter; an
// empty input commits null (clears the override). Used for permanent EDLP cuts
// (off current base) and temporary-allowance promos (off the base/white-tag
// price). The $/% mode can be self-managed (internal toggle) or driven from a
// parent — pass `mode` to control it and `hideToggle` to drop the inline toggle.
export function ReductionInput({
  reference,
  value,
  onCommit,
  defaultMode = "amount",
  mode: modeProp,
  hideToggle = false,
}: {
  reference: number;
  value: number | null | undefined;
  onCommit: (price: number | null) => void;
  defaultMode?: Mode;
  mode?: Mode;
  hideToggle?: boolean;
}) {
  const [internalMode, setInternalMode] = useState<Mode>(defaultMode);
  const mode = modeProp ?? internalMode;
  const setMode = setInternalMode;
  const [raw, setRaw] = useState(() => reductionFor(modeProp ?? defaultMode, reference, value ?? null));

  // Resync when the committed price or the mode changes. `value` only moves on
  // commit (not while typing), so this never clobbers in-progress input.
  useEffect(() => {
    setRaw(reductionFor(mode, reference, value ?? null));
  }, [value, mode, reference]);

  const commit = () => {
    if (raw.trim() === "") {
      onCommit(null);
      return;
    }
    const n = parseFloat(raw);
    if (isNaN(n)) {
      onCommit(null);
      return;
    }
    const price = mode === "amount" ? reference - n : reference * (1 - n / 100);
    onCommit(Math.round(Math.max(0, price) * 100) / 100);
  };

  return (
    <div className="flex items-center gap-2">
      {!hideToggle && (
        <div className="flex overflow-hidden rounded-md border border-gray-300">
          {(["amount", "pct"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-2.5 py-1.5 text-sm font-medium ${
                mode === m ? "bg-brand text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {m === "amount" ? "$" : "%"}
            </button>
          ))}
        </div>
      )}
      <div className="relative w-[90px]">
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          placeholder="0"
          onChange={(e) => {
            // Digits with up to 2 decimals only — reject letters/symbols.
            if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setRaw(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`w-full rounded-md border border-gray-300 bg-white py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            mode === "amount" ? "pl-6 pr-2.5" : "pl-2.5 pr-7"
          }`}
          aria-label={mode === "amount" ? "Reduction amount in dollars" : "Reduction percent"}
        />
        <span
          className={`absolute top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none ${
            mode === "amount" ? "left-2.5" : "right-2.5"
          }`}
        >
          {mode === "amount" ? "$" : "%"}
        </span>
      </div>
    </div>
  );
}
