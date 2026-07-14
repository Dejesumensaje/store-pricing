"use client";

import { useState } from "react";
import { QtyPriceInput } from "./QtyPriceInput";
import { derivePriceState } from "./PriceInputCell";
import { OverrideStatus } from "@/types/pricing";
import { round2 } from "@/lib/pricing-math";

// The two shapes a plain (non-EDLP) base price can take: one shelf price, or a
// pack-size deal ("3 for $6.00"). Mirrors the retail chooser's pick-the-kind-
// first model so the two price decisions feel the same.
type Method = "multi" | "exact";

const METHODS: { id: Method; label: string }[] = [
  { id: "multi", label: "Multi-unit" },
  { id: "exact", label: "Exact price" },
];

// A committed multi-unit quantity opens "Multi-unit"; anything else opens
// "Exact price" (a base price is most naturally set by typing the shelf price).
function initialMethod(qty: number | null): Method {
  return qty != null && qty > 1 ? "multi" : "exact";
}

// Progressive base-price control for plain base items. Both methods take a
// price directly; "Multi-unit" adds the pack quantity. Only the chosen
// method's input is mounted.
export function BasePriceMethodField({
  recommended,
  qty,
  price,
  status,
  hasAlert,
  onCommit,
}: {
  /** Ghost placeholder for the price input (e.g. HQ's recommended price). */
  recommended: number;
  qty: number | null;
  /** Total price for `qty` units. qty 1 (or null) = single-unit price. */
  price: number | null;
  status?: OverrideStatus;
  hasAlert?: boolean;
  onCommit: (qty: number, price: number | null) => void;
}) {
  const [method, setMethod] = useState<Method>(() => initialMethod(qty));
  const state = derivePriceState({ value: price, status, hasAlert });

  // Switching methods must preserve the PER-UNIT price, not the deal total
  // (same rule as the retail chooser): $4.50 entering Multi-unit seeds
  // "2 for $9.00"; leaving collapses the deal total back to the per-unit price.
  const selectMethod = (m: Method) => {
    if (m === method) return;
    const dealQty = qty ?? 1;
    if (price != null) {
      if (m === "multi" && dealQty <= 1) {
        onCommit(2, round2(price * 2));
      } else if (m === "exact" && dealQty > 1) {
        onCommit(1, round2(price / dealQty));
      }
    }
    setMethod(m);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* One shelf price or a pack deal? — one path at a time.
          Two buttons fit in one row even on narrow screens; overflow-hidden
          clips the active-tab highlight to the container's border-radius
          (matches BaseReductionField so both white-tag pickers feel the same). */}
      <div
        role="group"
        aria-label="Pricing method"
        className="flex w-fit overflow-hidden rounded-lg border border-gray-300"
      >
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectMethod(m.id)}
            aria-pressed={method === m.id}
            className={`whitespace-nowrap border-l border-gray-300 px-3 py-1.5 text-sm font-medium first:border-l-0 ${
              method === m.id ? "bg-brand text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <QtyPriceInput
        qty={qty}
        price={price}
        recommendedPrice={recommended}
        state={state}
        multi={method === "multi"}
        onCommit={onCommit}
      />
    </div>
  );
}
