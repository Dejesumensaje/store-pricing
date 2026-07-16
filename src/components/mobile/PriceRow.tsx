"use client";

import { Minus, Plus } from "lucide-react";
import { fmt, fmtUnitPrice } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";

type Props = {
  /** Small-caps left column label — "Retail" / "Base". */
  label: string;
  /** Retail is the hero row (largest price type); Base renders one step down. */
  hero?: boolean;
  qty: number;
  onQtyChange: (qty: number) => void;
  displayCents: number;
  active: boolean;
  /** True once digits landed this edit — until then the active field renders
      placeholder-dimmed (the first keypad digit REPLACES the shown price). */
  hasDraft: boolean;
  /** Extra dim for the $0.00 no-promo blank slate. */
  dimZero?: boolean;
  /** "was $5.99" — the fixed reference shown only once a draft exists, so the
      row itself carries the old→new comparison (no separate review screen). */
  wasLabel?: string | null;
  /** Anchor line for the blank slate ("no promo yet · base $X"). Shown only
      while the row is untouched — once editing starts it's noise (base is
      visible two rows down on the same card). */
  subLabel?: string | null;
  /** Multi-unit ("N for $X") behind a conscious opt-in: the stepper stays
      hidden until the director taps the quiet "+ Multi-unit price" action
      (shown only while the row is active). Rows already carrying a
      multi-unit deal open with the stepper visible. */
  multiUnitOptIn?: boolean;
  error?: string | null;
  onFocus: () => void;
  /** Bumped when a value is set programmatically (HQ accept / ladder fix) —
      replays decision-pop on the box so the choice visibly registers. */
  popToken?: number;
  /** Rec block, ladder strip, date/reason chips — consequences attach
      directly under the row that caused them. */
  children?: React.ReactNode;
};

// One row of the unified pricing card. The grammar is constant — label left,
// price box right, stepper only while relevant — so Retail and Base read as
// the same kind of thing at two sizes. Monochrome except: brand marks the
// active field, red marks errors (same system as the rest of the shell).
export function PriceRow({
  label,
  hero,
  qty,
  onQtyChange,
  displayCents,
  active,
  hasDraft,
  dimZero,
  wasLabel,
  subLabel,
  multiUnitOptIn,
  error,
  onFocus,
  popToken,
  children,
}: Props) {
  const total = displayCents / 100;
  // Sub-line only when it carries information: the "was" reference on a
  // drafted row, per-unit math on a multi-unit price, and — only while the
  // row is untouched — the blank-slate anchor.
  const subParts = [
    wasLabel ?? null,
    qty > 1 ? fmtUnitPrice(qty, total) : null,
    !active && !hasDraft ? subLabel ?? null : null,
  ].filter(Boolean);
  const dimmed = !hasDraft && (active || (dimZero && displayCents === 0));
  const showStepper = multiUnitOptIn ? qty > 1 : active || qty > 1;
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className={`w-14 shrink-0 text-xs font-semibold uppercase tracking-wide ${active ? "text-brand" : "text-gray-700"}`}>
          {label}
        </span>
        {/* Stepper only while it means something: the row is being edited (or
            opted in, below), or a multi-unit deal already exists. */}
        {showStepper && <QtyStepper qty={qty} onChange={onQtyChange} label={label.toLowerCase()} />}
        <button
          type="button"
          onClick={onFocus}
          aria-label={`Edit ${label.toLowerCase()} price`}
          className={`min-w-0 flex-1 rounded-lg border-2 px-3 py-1.5 text-left transition-colors ${
            active ? "border-brand bg-brand/10" : "border-gray-300 bg-gray-50"
          }`}
        >
          <span key={popToken} className={popToken ? "decision-pop block" : "block"}>
            {/* Multi-unit totals ("3 for $12.00") are ~3× longer than a bare
                price — one type-size down keeps them whole at 360px. */}
            <span
              className={`block truncate font-bold tabular-nums ${hero && qty <= 1 ? "text-2xl" : "text-xl"} ${
                dimmed ? "text-gray-400" : "text-gray-900"
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
          </span>
        </button>
      </div>
      {/* Error stays glued to the box that caused it — everything else
          (opt-in, rec blocks, chips) queues below. */}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
      {/* The conscious opt-in — and its explicit way back. Multi-unit is a
          deliberate pricing move, not a default control: the pair appears
          only while editing this row, and yields while an error (and its fix
          chip, in children) is up. The fallback sets qty straight to 1 (the
          typed amount simply becomes the single-unit price) — no stepping
          down through the counts. */}
      {multiUnitOptIn && active && !error && (
        qty === 1 ? (
          <button
            type="button"
            onClick={() => onQtyChange(2)}
            className="flex min-h-9 select-none touch-manipulation items-center gap-1 self-start text-sm font-medium text-brand active:opacity-70"
          >
            <Plus className="size-4" aria-hidden="true" />
            Multi-unit price (N for $X)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onQtyChange(1)}
            className="flex min-h-9 select-none touch-manipulation items-center gap-1 self-start text-sm font-medium text-brand active:opacity-70"
          >
            <Minus className="size-4" aria-hidden="true" />
            Single-unit price
          </button>
        )
      )}
      {children}
    </div>
  );
}
