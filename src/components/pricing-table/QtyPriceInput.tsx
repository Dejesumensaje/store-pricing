"use client";

import { useState, useEffect } from "react";
import { Button, Switch } from "@dejesumensaje/converge-ds-experimental";
import { Check, AlertCircle } from "lucide-react";
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
  onCommit: (qty: number, price: number | null) => void;
  onViewAlerts?: () => void;
};

// Retail price for the allowance. Single-unit by default — one plain price
// input. Flipping "Multi-unit deal" reveals the quantity field and per-unit
// math ("N for $X"), so the deal is an explicit choice rather than implied by
// whatever number lands in a qty box.
export function QtyPriceInput({ qty, price, recommendedPrice, state, onCommit, onViewAlerts }: Props) {
  const [multi, setMulti] = useState(qty != null && qty > 1);
  const [draftQty, setDraftQty] = useState(qty != null && qty > 1 ? String(qty) : "");
  const [draftPrice, setDraftPrice] = useState(price != null ? price.toFixed(2) : "");

  useEffect(() => {
    const isMulti = qty != null && qty > 1;
    setMulti(isMulti);
    setDraftQty(isMulti ? String(qty) : "");
  }, [qty]);
  useEffect(() => {
    setDraftPrice(price != null ? price.toFixed(2) : "");
  }, [price]);

  const liveQty = multi ? Math.max(2, parseInt(draftQty, 10) || 2) : 1;
  const livePrice = parseFloat(draftPrice);
  const isDeal = multi && !isNaN(livePrice) && livePrice > 0;

  const commit = () => {
    if (isNaN(livePrice)) {
      onCommit(1, null); // no price = no decision; clears the override
      return;
    }
    onCommit(liveQty, livePrice);
  };

  // Switching modes re-commits with the right qty so the row stays in sync,
  // but only once a price exists — an empty field is still "no decision".
  const toggleMulti = (on: boolean) => {
    setMulti(on);
    if (on) {
      const nextQty = parseInt(draftQty, 10) >= 2 ? parseInt(draftQty, 10) : 2;
      setDraftQty(String(nextQty));
      if (!isNaN(livePrice)) onCommit(nextQty, livePrice);
    } else {
      setDraftQty("");
      if (!isNaN(livePrice)) onCommit(1, livePrice);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Switch
        checked={multi}
        onCheckedChange={toggleMulti}
        label="Multi-unit deal"
        labelPosition="right"
        size="sm"
      />

      <div className="flex flex-col gap-0.5">
        {multi ? (
          <div
            className={`flex items-center w-[170px] border rounded-md focus-within:ring-2 focus-within:ring-blue-500 ${BORDER[state]}`}
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
              className="w-8 py-1.5 text-sm text-center bg-transparent focus:outline-none placeholder:text-gray-400"
            />
            <span className="text-xs text-gray-400 select-none shrink-0 border-l border-gray-200 pl-1.5">
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
              className="w-0 flex-1 pr-2 py-1.5 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
            />
          </div>
        ) : (
          <div className="relative w-[120px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
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
              className={`w-full pl-6 pr-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${BORDER[state]}`}
            />
          </div>
        )}

        {state === "sent" ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium pl-1">
            <Check className="size-3" /> Sent{isDeal ? ` · ${fmtUnitPrice(liveQty, livePrice)}` : ""}
          </span>
        ) : state === "alert" ? (
          <Button variant="tertiary" size="sm" iconLeft={AlertCircle} onClick={onViewAlerts}>
            View alerts
          </Button>
        ) : isDeal ? (
          <span className="text-xs text-gray-500 pl-1">
            {fmtQtyPrice(liveQty, livePrice)} · {fmtUnitPrice(liveQty, livePrice)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
