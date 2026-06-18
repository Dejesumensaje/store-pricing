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
};

export const BORDER: Record<PriceCellState, string> = {
  untouched: "border-gray-300 bg-white text-gray-400",
  edited: "border-gray-900 bg-white text-gray-900",
  sent: "border-emerald-500 bg-white text-gray-900",
  alert: "border-orange-400 bg-white text-gray-900",
};

export function PriceInputCell({ recommended, value, state, onCommit, onViewAlerts, autoFocus }: Props) {
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : "");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative w-[120px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={recommended.toFixed(2)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            const parsed = parseFloat(draft);
            onCommit(isNaN(parsed) ? null : parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`w-full pl-6 pr-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${BORDER[state]}`}
        />
      </div>
      {state === "sent" && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium pl-1">
          <Check className="size-3" /> Sent
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
