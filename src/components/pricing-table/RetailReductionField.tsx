"use client";

import { useState } from "react";
import { ReductionInput } from "./ReductionInput";
import { QtyPriceInput } from "./QtyPriceInput";
import { derivePriceState } from "./PriceInputCell";
import { OverrideStatus } from "@/types/pricing";
import { fmt } from "@/lib/format";

// The four ways a director can set an allowance retail price. The mental model
// (per Neil/HQ) is to pick the *kind* of discount first, then enter the number —
// so we surface one path at a time instead of every input at once.
type Method = "pct" | "amount" | "multi" | "exact";

const METHODS: { id: Method; label: string }[] = [
  { id: "pct", label: "% off" },
  { id: "amount", label: "$ off" },
  { id: "multi", label: "Multi-unit" },
  { id: "exact", label: "Exact price" },
];

// Infer the starting method from a committed deal: a multi-unit quantity opens
// "Multi-unit"; any other committed price opens "Exact price"; an untouched
// field defaults to "% off" (the most common allowance promo).
function initialMethod(qty: number | null, price: number | null): Method {
  if (qty != null && qty > 1) return "multi";
  if (price != null) return "exact";
  return "pct";
}

// Progressive retail-price control for a temporary allowance. The % / $ off
// reductions are computed off the base (white-tag) price; multi-unit and exact
// take a price directly. Only the chosen method's input is mounted.
export function RetailReductionField({
  baseReference,
  recommendedPrice,
  qty,
  price,
  status,
  onCommit,
}: {
  /** White-tag base price the % / $ reduction is computed off. */
  baseReference: number;
  /** Ghost placeholder for the exact / multi-unit inputs. */
  recommendedPrice: number;
  qty: number | null;
  price: number | null;
  status?: OverrideStatus;
  onCommit: (qty: number, price: number | null) => void;
}) {
  const [method, setMethod] = useState<Method>(() => initialMethod(qty, price));

  // The committed per-unit price (a deal divides its total across the quantity).
  const unit = price != null ? price / Math.max(1, qty ?? 1) : null;
  const state = derivePriceState({ value: price, status });

  return (
    <div className="flex flex-col gap-3">
      {/* How do you want to discount? — one path at a time. */}
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
            reference={baseReference}
            value={unit}
            mode={method}
            hideToggle
            onCommit={(p) => onCommit(1, p)}
          />
          {unit != null && (
            <p className="text-xs tabular-nums text-gray-500">
              {method === "pct"
                ? `${Math.max(0, Math.round((1 - unit / baseReference) * 100))}% off ${fmt(baseReference)} (base)`
                : `${fmt(Math.max(0, baseReference - unit))} off ${fmt(baseReference)} (base)`}
              {" = "}
              <span className="font-medium text-gray-700">{fmt(unit)}</span>
            </p>
          )}
        </div>
      )}

      {(method === "multi" || method === "exact") && (
        <QtyPriceInput
          qty={qty}
          price={price}
          recommendedPrice={recommendedPrice}
          state={state}
          multi={method === "multi"}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
