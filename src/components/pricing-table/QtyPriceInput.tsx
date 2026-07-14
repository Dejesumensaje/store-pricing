"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle } from "lucide-react";
import { PriceCellState, BORDER } from "./PriceInputCell";
import { fmtQtyPrice, fmtUnitPrice } from "@/lib/format";

type Props = {
  /** Units in the deal. null or 1 = single-unit. */
  qty: number | null;
  /** Total price for `qty` units. null = untouched. */
  price: number | null;
  /** Shown as the price placeholder when untouched. */
  recommendedPrice: number;
  state: PriceCellState;
  /** Multi-unit mode (controlled by the field's "Multi-unit deal" toggle). */
  multi: boolean;
  onCommit: (qty: number, price: number | null) => void;
  onViewAlerts?: () => void;
};

// Retail price for the allowance. The "Multi-unit deal" toggle (owned by the
// field above) decides the shape: off = one plain price; on = quantity + price
// with per-unit math ("N for $X").
export function QtyPriceInput({ qty, price, recommendedPrice, state, multi, onCommit, onViewAlerts }: Props) {
  const [draftQty, setDraftQty] = useState(qty != null && qty > 1 ? String(qty) : "");
  const [draftPrice, setDraftPrice] = useState(price != null ? price.toFixed(2) : "");
  // Brief confirmation flash after a successful commit (parity with PriceInputCell).
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  useEffect(() => {
    setDraftQty(qty != null && qty > 1 ? String(qty) : "");
  }, [qty]);
  useEffect(() => {
    setDraftPrice(price != null ? price.toFixed(2) : "");
  }, [price]);

  const liveQty = multi ? Math.max(2, parseInt(draftQty, 10) || 2) : 1;
  const livePrice = parseFloat(draftPrice);
  const isDeal = multi && !isNaN(livePrice) && livePrice > 0;

  // NOTE: the per-unit-preserving math for switching into/out of multi-unit lives
  // in RetailReductionField.selectMethod (the single owner of method transitions),
  // so the stored deal stays consistent (e.g. $4.50/unit → "2 for $9.00"). This
  // input just reflects the qty/price props it's given.

  const commit = () => {
    if (isNaN(livePrice)) {
      onCommit(1, null); // no price = no decision; clears the override
      return;
    }
    onCommit(liveQty, livePrice);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 600);
  };

  const fieldTone = flash ? "border-emerald-300 bg-emerald-50 text-gray-900" : BORDER[state];

  return (
    <div className="flex flex-col gap-0.5">
      {multi ? (
        <div
          className={`flex items-center w-[170px] max-md:w-full border rounded-md transition-colors duration-500 motion-reduce:transition-none focus-within:ring-2 focus-within:ring-blue-500 ${fieldTone}`}
          onBlur={(e) => {
            // Commit only when focus leaves the whole control, so tabbing from
            // qty to price never commits a half-edited deal.
            if (!e.currentTarget.contains(e.relatedTarget as Node)) commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            value={draftQty}
            placeholder="2"
            aria-label="Quantity"
            onChange={(e) => {
              if (/^\d{0,2}$/.test(e.target.value)) setDraftQty(e.target.value);
            }}
            className="w-8 py-1.5 text-sm text-center bg-transparent focus:outline-none placeholder:text-gray-500"
          />
          <span className="text-xs text-gray-500 select-none shrink-0 border-l border-gray-200 pl-1.5">
            for
          </span>
          <span className="text-sm text-gray-500 pl-1 select-none">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftPrice}
            placeholder={recommendedPrice.toFixed(2)}
            aria-label="Price"
            onChange={(e) => {
              if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setDraftPrice(e.target.value);
            }}
            className="w-0 flex-1 pr-2 py-1.5 text-sm bg-transparent focus:outline-none placeholder:text-gray-500"
          />
        </div>
      ) : (
        <div className="relative w-[120px] max-md:w-full">
          <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftPrice}
            placeholder={recommendedPrice.toFixed(2)}
            aria-label="Price"
            onChange={(e) => {
              if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setDraftPrice(e.target.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={`w-full pl-6 pr-2 py-1.5 text-sm border rounded-md transition-colors duration-500 motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldTone}`}
          />
        </div>
      )}

      {state === "alert" ? (
        <Button variant="tertiary" size="sm" iconLeft={AlertCircle} onClick={onViewAlerts}>
          View alerts
        </Button>
      ) : isDeal ? (
        <span className="text-xs text-gray-500 pl-1">
          {fmtQtyPrice(liveQty, livePrice)} · {fmtUnitPrice(liveQty, livePrice)}
        </span>
      ) : null}
    </div>
  );
}
