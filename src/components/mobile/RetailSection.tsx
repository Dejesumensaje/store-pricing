"use client";

import { fmt, fmtUnitPrice } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";

type Props = {
  qty: number;
  onQtyChange: (qty: number) => void;
  displayCents: number;
  /** "was $X.XX" — the live per-unit shelf price reference. */
  wasLabel: string;
  active: boolean;
  /** True once the director has typed digits this edit. Until then the
      active field renders its amount placeholder-dimmed: the first keypad
      digit REPLACES the shown price rather than appending to it, and the
      dimmed treatment signals that. */
  hasDraft: boolean;
  error: string | null;
  onFocus: () => void;
  /** Meta chip row (promo window + reason) — present once this section has a
      change to describe. */
  meta?: React.ReactNode;
};

// The primary section — multi-unit promos ("N for $X") get the prominent
// stepper+price layout here, mirroring Base's expanded editor exactly (same
// card, same internal heading, same stepper) so the two read as one system.
// No % off / $ off on mobile. The price box is the default keypad target the
// moment the item opens.
export function RetailSection({ qty, onQtyChange, displayCents, wasLabel, active, hasDraft, error, onFocus, meta }: Props) {
  const total = displayCents / 100;
  return (
    /* Yellow-tag identity — the same shelf-tag color language as the desktop
       table and the session tray, so the promo lever is recognizable at a
       glance instead of blending with Base/Fuel. Focus is carried by the
       price box (border + caret + dimmed amount), not the card color. */
    <section className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
        <span aria-hidden="true" className="size-2.5 rounded-sm border border-amber-400 bg-amber-300" />
        Retail
      </h3>
      <div className="flex items-center gap-3">
        <QtyStepper qty={qty} onChange={onQtyChange} label="retail" />
        <button
          type="button"
          onClick={onFocus}
          aria-label="Edit retail price"
          className={`min-w-0 flex-1 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
            active ? "border-brand bg-brand/5" : "border-gray-200 bg-white"
          }`}
        >
          <span
            className={`block truncate text-2xl font-bold tabular-nums ${
              /* Dimmed while awaiting input: focused-but-untouched, or the
                 $0.00 blank slate of an item with no promo yet. */
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
          <span className="block truncate text-xs text-gray-500">
            {qty > 1 ? `${fmtUnitPrice(qty, total)} · ${wasLabel}` : wasLabel}
          </span>
        </button>
      </div>
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
      {meta && <div className="flex flex-wrap gap-2">{meta}</div>}
    </section>
  );
}
