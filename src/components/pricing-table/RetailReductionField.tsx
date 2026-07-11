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
  return "exact";
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

  // Switching methods must preserve the PER-UNIT price, not the deal total, so a
  // discount survives the jump into (and out of) multi-unit. Example: $5 → 10% =
  // $4.50/unit; entering Multi-unit seeds "2 for $9.00" (4.50 × 2), not "2 for
  // $4.50". Leaving multi-unit collapses the deal total back to the per-unit price.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const selectMethod = (m: Method) => {
    if (m === method) return;
    const dealQty = qty ?? 1;
    if (price != null) {
      if (m === "multi" && dealQty <= 1) {
        onCommit(2, round2(price * 2));
      } else if (m !== "multi" && dealQty > 1) {
        onCommit(1, round2(price / dealQty));
      }
    }
    setMethod(m);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* How do you want to discount? — one path at a time.
          On mobile: 2×2 grid so all four labels are visible and the active tab
          is never clipped. On desktop: single-row flex (original layout). */}
      <div
        role="group"
        aria-label="Pricing method"
        className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-300 md:flex md:w-fit"
      >
        {METHODS.map((m, i) => {
          const isRightCol = i % 2 === 1;
          const isBottomRow = i >= 2;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => selectMethod(m.id)}
              aria-pressed={method === m.id}
              className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium${
                isRightCol ? " border-l border-gray-300" : ""
              }${isBottomRow ? " border-t border-gray-300" : ""}${
                i > 0 ? " md:border-l md:border-gray-300" : " md:border-l-0"
              } md:border-t-0 ${
                method === m.id ? "bg-brand text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m.label}
            </button>
          );
        })}
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
