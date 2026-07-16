"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { fmt, fmtUnitPrice } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";

type Props = {
  open: boolean;
  onToggle: () => void;
  currentLabel: string;
  active: boolean;
  displayCents: number;
  qty: number;
  onQtyChange: (qty: number) => void;
  onFocus: () => void;
  /** See RetailSection — dims the amount until the first digit lands. */
  hasDraft: boolean;
  error: string | null;
  notice: string | null;
  familyNote?: string | null;
};

// Intentionally secondary — collapsed behind a disclosure (Base is the least
// frequently touched section during a walk). Opens into a qty stepper + a
// price keypad target, same big-readout pattern as Retail. Monochrome: the
// smaller price box and the collapsed-by-default posture carry "secondary"
// in black and white.
export function BaseDisclosure({
  open,
  onToggle,
  currentLabel,
  active,
  displayCents,
  qty,
  onQtyChange,
  onFocus,
  hasDraft,
  error,
  notice,
  familyNote,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  // Multi-unit ("N for $X") on base sits behind one more friction point: a
  // quiet text action reveals the stepper, starting at 2 (revealing at 1
  // would mean nothing). Items already carrying a multi-unit base open with
  // it revealed. Resets per item via EditScreen's key remount.
  const [multiUnit, setMultiUnit] = useState(qty > 1);
  // Base sits low in the scroll zone, just above the keypad dock. When it
  // expands — or when its field re-summons the keypad (which shrinks the
  // scroll zone) — pull the editor (stepper, price field, and any EDLP
  // error/notice) into view so it isn't hidden behind the keypad.
  useEffect(() => {
    if (open) sectionRef.current?.scrollIntoView({ block: "end" });
  }, [open, active]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">{currentLabel}</span>
        <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
      </button>
    );
  }
  const total = displayCents / 100;
  return (
    /* Once opened, Base stays open for this item — the header matches
       Retail's grammar exactly, so the two open editors read as the same
       kind of thing. The next scan resets it collapsed. */
    <section ref={sectionRef} className="flex flex-col gap-2 rounded-xl border border-gray-300 bg-white p-3">
      {/* Label tints with its box: color marks the active field only. */}
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-brand" : "text-gray-700"}`}>
        Base price
      </h3>
      <div className="flex items-center gap-3">
        {multiUnit && <QtyStepper qty={qty} onChange={onQtyChange} label="base" />}
        <button
          type="button"
          onClick={onFocus}
          aria-label="Edit base price"
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
            active ? "border-brand bg-brand/10" : "border-gray-300 bg-gray-50"
          }`}
        >
          <span
            className={`block text-xl font-bold tabular-nums ${
              active && !hasDraft ? "text-gray-400" : "text-gray-900"
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
          {qty > 1 && <span className="block text-xs text-gray-500">{fmtUnitPrice(qty, total)}</span>}
        </button>
      </div>
      {!multiUnit && (
        <button
          type="button"
          onClick={() => {
            setMultiUnit(true);
            onQtyChange(Math.max(2, qty));
          }}
          className="flex min-h-10 select-none touch-manipulation items-center gap-1 self-start text-sm font-medium text-brand active:opacity-70"
        >
          <Plus className="size-4" aria-hidden="true" />
          Multi-unit price (N for $X)
        </button>
      )}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
      {notice && <span className="text-xs font-medium text-amber-700">{notice}</span>}
      {familyNote && <span className="text-xs text-gray-500">{familyNote}</span>}
    </section>
  );
}
