"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, Minus } from "lucide-react";
import { fmt, fmtUnitPrice } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";

type Props = {
  /** Block label above the number — "Retail" / "Base price". */
  label: string;
  /** Stable field name ("retail" / "base") for aria-labels and the stepper —
      the visible label can evolve, the selectors must not. */
  ariaField: string;
  /** Retail is the hero row (largest price type); Base renders one step down. */
  hero?: boolean;
  qty: number;
  onQtyChange: (qty: number) => void;
  displayCents: number;
  active: boolean;
  /** True once digits landed this edit — until then the active field renders
      placeholder-dimmed (the first keypad digit REPLACES the shown price). */
  hasDraft: boolean;
  /** "was $5.99" — the fixed reference shown only once a draft exists, so the
      row itself carries the old→new comparison (no separate review screen). */
  wasLabel?: string | null;
  /** This price's live gross margin (percent), inline ground beside the
      price — information, never a control. Null hides the slot. */
  marginPct?: number | null;
  /** Multi-unit ("N for $X") behind a conscious opt-in: a quiet header-row
      link, shown only while the row is active (or already multi-unit).
      Rows carrying a multi-unit deal open with the stepper visible. */
  multiUnitOptIn?: boolean;
  error?: string | null;
  onFocus: () => void;
  /** Bumped when a value is set programmatically (HQ accept / ladder fix) —
      replays decision-pop + accept-ring on the numeral so the choice lands. */
  popToken?: number;
  /** Rec block, ladder strip, date/reason chips — consequences attach
      directly under the row that caused them, in one fixed slot order. */
  children?: React.ReactNode;
};

// The reactive-margin delta: the NET margin change across one edit, flashed
// once the value settles (the field is released) — not per keystroke, which
// would spike on half-typed prices like $0.02. This is why the walk exists: a
// multi-unit deal can push the unit price under the funded cost, and the
// merchant sees exactly how far the margin moved.
function useMarginDelta(marginPct: number | null | undefined, active: boolean) {
  const startRef = useRef<number | null>(null); // margin when the edit began
  const wasActive = useRef(active);
  const token = useRef(0);
  const [delta, setDelta] = useState<{ v: number; token: number } | null>(null);
  useEffect(() => {
    const prevActive = wasActive.current;
    wasActive.current = active;
    if (active && !prevActive) {
      startRef.current = marginPct ?? null; // began editing — remember the start
      return;
    }
    if (!active && prevActive) {
      const start = startRef.current;
      startRef.current = null;
      if (start == null || marginPct == null || Math.abs(marginPct - start) <= 0.05) return;
      token.current += 1;
      const t = token.current;
      setDelta({ v: marginPct - start, token: t });
      const clear = setTimeout(() => setDelta((d) => (d?.token === t ? null : d)), 1900);
      return () => clearTimeout(clear);
    }
  }, [active, marginPct]);
  return delta;
}

// Live margins go absurd on half-typed prices ($0.02 → −11900%); the number is
// only meaningful once enough is typed. Below the floor we show that it's under
// cost without the noise; a real, modest under-cost still reads as its number.
function marginLabel(pct: number): string {
  if (pct <= -100) return "under cost";
  return `${pct.toFixed(1)}%`;
}

// Mechanical counter for programmatic sets (HQ accept / ladder fix): the
// numeral COUNTS from the old price to the new one (~400ms ease-out), every
// intermediate cent rendered — the recommendation is applied, not swapped.
// Typing stays instant (only a popToken bump engages the counter); reduced
// motion snaps. The margin is FROZEN at its pre-set value while counting and
// released when the counter settles — the number lands first, its
// consequence follows.
function useCountingCents(target: number, popToken: number | undefined, marginPct: number | null | undefined) {
  const [shown, setShownState] = useState(target);
  const shownRef = useRef(target);
  // Non-null while counting: the margin as of the render BEFORE the set.
  const [frozen, setFrozen] = useState<{ margin: number | null } | null>(null);
  const prevPop = useRef(popToken ?? 0);
  const prevMargin = useRef<number | null>(marginPct ?? null);
  const raf = useRef(0);
  useEffect(() => {
    const setShown = (v: number) => {
      shownRef.current = v;
      setShownState(v);
    };
    const pop = popToken ?? 0;
    const popped = pop !== prevPop.current && pop > 0;
    prevPop.current = pop;
    const from = shownRef.current;
    if (!popped || from === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cancelAnimationFrame(raf.current);
      if (from !== target) setShown(target);
      setFrozen(null);
      return;
    }
    setFrozen({ margin: prevMargin.current });
    const start = performance.now();
    const DUR = 400;
    const tick = (t: number) => {
      const p = Math.min((t - start) / DUR, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setFrozen(null);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, popToken]);
  // Recorded AFTER the counting effect (declaration order), so a programmatic
  // set freezes the margin from before the set, not the already-new one.
  useEffect(() => {
    prevMargin.current = marginPct ?? null;
  });
  return { shownCents: shown, shownMargin: frozen ? frozen.margin : marginPct ?? null };
}

// One section of the unified pricing surface. The grammar is constant — quiet
// label above, bare bold numeral (the filled figure), margin as light inline
// ground, stepper below only while relevant — so Retail and Base read as the
// same kind of thing at two sizes. The affordance convention: bold gray-900
// tabular numerals are editable; the ACTIVE one is the only chrome (brand
// tint + caret + the keypad rising). Derived numbers stay caption-gray.
export function PriceRow({
  label,
  ariaField,
  hero,
  qty,
  onQtyChange,
  displayCents,
  active,
  hasDraft,
  wasLabel,
  marginPct,
  multiUnitOptIn,
  error,
  onFocus,
  popToken,
  children,
}: Props) {
  const { shownCents, shownMargin } = useCountingCents(displayCents, popToken, marginPct);
  const total = shownCents / 100;
  const delta = useMarginDelta(marginPct, active);
  const dimmed = active && !hasDraft;
  const showStepper = multiUnitOptIn ? qty > 1 : active || qty > 1;
  const showOptIn = multiUnitOptIn && (active || qty > 1);
  // Multi-unit totals ("3 for $12.00") are ~3× longer than a bare price —
  // one type-size down keeps the hero near-hero instead of deflating it at
  // the moment the decision is most complex.
  const sizeCls = hero ? (qty > 1 ? "text-[40px]" : "text-[48px]") : qty > 1 ? "text-[26px]" : "text-[34px]";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-medium ${active ? "text-brand" : "text-gray-400"}`}>{label}</span>
        {/* The conscious opt-in — and its explicit way back — lives in the
            header row, out of the number's way. Multi-unit is a deliberate
            pricing move, not a default control. */}
        {showOptIn &&
          (qty === 1 ? (
            <button
              type="button"
              onClick={() => onQtyChange(2)}
              className="flex min-h-9 select-none touch-manipulation items-center gap-1 text-sm font-medium text-brand active:opacity-70"
            >
              <Crop className="size-4" aria-hidden="true" />
              Multi-unit price (N for $X)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onQtyChange(1)}
              className="flex min-h-9 select-none touch-manipulation items-center gap-1 text-sm font-medium text-brand active:opacity-70"
            >
              <Minus className="size-4" aria-hidden="true" />
              Use single price
            </button>
          ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={onFocus}
          aria-label={`Edit ${ariaField} price`}
          className="min-w-0 select-none touch-manipulation py-0.5 text-left"
        >
          {/* Keyed on popToken so a programmatic set (HQ accept / ladder fix)
              replays both the pop and the green "locked in" ring. Roomy
              padding + soft radius: a pricing instrument, not a text input.
              The left margin is negative so the numeral itself never shifts
              when the tint appears (it grows toward the gutter, not the
              figure); the right padding is REAL layout space, so the box
              reserves room for the caret and pushes the GM ground clear
              instead of overflowing onto it. */}
          <span
            key={popToken}
            className={`block rounded-[18px] ${popToken ? "decision-pop accept-ring " : ""}${
              active ? "-ml-3 -my-1 bg-brand/10 py-1 pl-3 pr-4" : ""
            }`}
          >
            <span
              className={`block w-fit max-w-full truncate font-bold leading-none tabular-nums ${sizeCls} ${
                dimmed ? "text-gray-300" : "text-gray-900"
              } ${active ? "" : "border-b border-dashed border-gray-300 pb-1.5"}`}
            >
              {qty > 1 ? `${qty} for ${fmt(total)}` : fmt(total)}
              {active && (
                <span
                  aria-hidden="true"
                  className="caret-blink ml-1 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] rounded-full bg-brand"
                />
              )}
            </span>
          </span>
        </button>
        {/* Margin is light inline ground — never a surface. The net delta
            springs in above it, positioned so it never reflows the layout. */}
        {shownMargin != null && (
          <span className="relative shrink-0 whitespace-nowrap text-xs text-gray-400">
            GM{" "}
            <span className={`text-sm font-semibold tabular-nums ${shownMargin < 0 ? "text-red-500" : "text-gray-500"}`}>
              {marginLabel(shownMargin)}
            </span>
            {delta && (
              <span
                key={delta.token}
                aria-hidden="true"
                className={`margin-delta pointer-events-none absolute -top-3.5 right-0 text-[11px] font-bold tabular-nums ${
                  delta.v < 0 ? "text-red-500" : "text-emerald-600"
                }`}
              >
                {delta.v > 0 ? "+" : "−"}
                {Math.abs(delta.v).toFixed(1)}
              </span>
            )}
          </span>
        )}
      </div>
      {wasLabel && <span className="text-xs text-gray-500">{wasLabel}</span>}
      {qty > 1 && <span className="text-xs italic text-gray-500">{fmtUnitPrice(qty, total)}</span>}
      {/* Stepper enters BELOW the numeral — the number is the anchor; nothing
          above it reflows when multi-unit engages. */}
      {showStepper && <QtyStepper qty={qty} onChange={onQtyChange} label={ariaField} />}
      {/* Error stays glued to the number that caused it — the rest of the
          consequence queue (fix chip, recs, chips) follows in children. */}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
      {children}
    </div>
  );
}
