"use client";

import { fmt, fmtUnitPrice } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";

type Props = {
  qty: number;
  onQtyChange: (qty: number) => void;
  displayCents: number;
  /** Optional anchor under the price — used only for the no-promo blank
      slate ("no promo yet · base $X"). The old "was $X" reference is gone:
      it repeated information without informing the decision. */
  subLabel?: string | null;
  active: boolean;
  /** True once the director has typed digits this edit. Until then the
      active field renders its amount placeholder-dimmed: the first keypad
      digit REPLACES the shown price rather than appending to it, and the
      dimmed treatment signals that. */
  hasDraft: boolean;
  error: string | null;
  onFocus: () => void;
};

// Step 1 of the two-step flow answers only "how much" — no dates, no
// reasons (those live on the review step). Deliberately monochrome: the
// sections must separate by structure and typography alone, legible in
// black and white. Retail's primacy is carried by its size (largest price
// box, always expanded), not by color.
export function RetailSection({ qty, onQtyChange, displayCents, subLabel, active, hasDraft, error, onFocus }: Props) {
  const total = displayCents / 100;
  // Sub-line only when it carries information: per-unit math on a multi-unit
  // price, and/or the blank-slate anchor.
  const subParts = [qty > 1 ? fmtUnitPrice(qty, total) : null, subLabel ?? null].filter(Boolean);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-gray-300 bg-white p-3">
      {/* Color marks exactly one thing on this screen: the active field.
          The label tints with its box so "where am I typing" is unmissable. */}
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-brand" : "text-gray-700"}`}>
        Retail
      </h3>
      <div className="flex items-center gap-3">
        <QtyStepper qty={qty} onChange={onQtyChange} label="retail" />
        <button
          type="button"
          onClick={onFocus}
          aria-label="Edit retail price"
          className={`min-w-0 flex-1 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
            active ? "border-brand bg-brand/10" : "border-gray-300 bg-gray-50"
          }`}
        >
          <span
            className={`block truncate text-2xl font-bold tabular-nums ${
              !hasDraft && (active || displayCents === 0) ? "text-gray-400" : "text-gray-900"
            }`}
          >
            {qty > 1 ? `${qty} for ${fmt(total)}` : fmt(total)}
            {active && (
              <span
                aria-hidden="true"
                className="caret-blink ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] rounded-full bg-brand"
              />
            )}
          </span>
          {subParts.length > 0 && <span className="block truncate text-xs text-gray-500">{subParts.join(" · ")}</span>}
        </button>
      </div>
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
    </section>
  );
}
