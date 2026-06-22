"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { Check, AlertCircle } from "lucide-react";

export type PriceCellState = "untouched" | "edited" | "sent" | "alert";

type Props = {
  /** Recommended value shown as placeholder when untouched. */
  recommended: number;
  /** Current override value (null = untouched). */
  value: number | null;
  state: PriceCellState;
  onCommit: (value: number | null) => void;
  onViewAlerts?: () => void;
  /** Focus + select on mount (fast keyboard entry in the drawer queue). */
  autoFocus?: boolean;
  /** Accessible name for the input (the visible Field label is not associated). */
  ariaLabel?: string;
};

export const BORDER: Record<PriceCellState, string> = {
  untouched: "border-gray-300 bg-white text-gray-500",
  edited: "border-gray-900 bg-white text-gray-900",
  sent: "border-emerald-500 bg-white text-gray-900",
  alert: "border-orange-400 bg-white text-gray-900",
};

export function PriceInputCell({ recommended, value, state, onCommit, onViewAlerts, autoFocus, ariaLabel }: Props) {
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : "");
  // Brief confirmation flash after a successful commit (the most frequent action
  // otherwise has no immediate feedback). Gated by motion-reduce in the class.
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value != null ? value.toFixed(2) : "");
  }, [value]);

  // Focus + select on mount for fast keyboard entry as the queue advances.
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [autoFocus]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const commit = () => {
    const parsed = parseFloat(draft);
    const next = isNaN(parsed) ? null : parsed;
    onCommit(next);
    if (next != null) {
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 600);
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative w-[120px]">
        <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={draft}
          placeholder={recommended.toFixed(2)}
          onChange={(e) => {
            // Digits with up to 2 decimals only — reject letters/symbols.
            if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setDraft(e.target.value);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`w-full pl-6 pr-2 py-1.5 text-sm border rounded-md transition-colors duration-500 motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-brand ${
            flash ? "border-emerald-300 bg-emerald-50 text-gray-900" : BORDER[state]
          }`}
        />
      </div>
      {state === "sent" && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium pl-1">
          <Check className="size-3" aria-hidden="true" /> Sent to SAP
        </span>
      )}
      {state === "alert" && (
        <Button variant="tertiary" size="sm" iconLeft={AlertCircle} onClick={onViewAlerts}>
          View alerts
        </Button>
      )}
    </div>
  );
}

// Works for any editable price field — pass the field's value and its
// override status (baseOverrideStatus or retailOverrideStatus).
export function derivePriceState(input: {
  value: number | null | undefined;
  status?: string;
  hasAlert?: boolean;
}): PriceCellState {
  if (input.status === "submitted") return "sent";
  if (input.hasAlert) return "alert";
  if (input.value != null) return "edited";
  return "untouched";
}
