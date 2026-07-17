"use client";

type FieldProps = {
  label: string;
  value: number;
  active: boolean;
  hasDraft: boolean;
  /** Signed delta vs. the baseline ("12 (+2)") — weekly units only. */
  delta?: number | null;
  onFocus: () => void;
  /** One-tap way back — present only while a draft exists this visit. */
  onUndo?: () => void;
};

// One integer keypad target — same active/caret grammar as the price boxes,
// so "tap a value, type on the keypad" is a single skill across the screen.
function IntField({ label, value, active, hasDraft, delta, onFocus, onUndo }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${active ? "text-brand" : "text-gray-400"}`}>{label}</span>
        {/* Reversible-draft editing: a corrected count returns to its found
            value in one tap, no keypad backspacing. */}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="min-h-9 select-none touch-manipulation px-1 text-xs font-semibold text-brand active:opacity-70"
          >
            Undo
          </button>
        )}
      </div>
      {/* Same affordance convention as the price rows: bare bold numeral,
          chrome only while active. One register BELOW base price — inventory
          is context, not a decision; it must not read as a third price. */}
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Edit ${label.toLowerCase()}`}
        className="select-none touch-manipulation py-0.5 text-left"
      >
        <span
          className={`inline-flex items-baseline gap-1.5 rounded-[18px] ${
            active ? "-my-1 bg-brand/10 py-1 pl-3 pr-4" : ""
          }`}
        >
          <span
            className={`w-fit text-[22px] font-semibold leading-none tabular-nums ${
              active && !hasDraft ? "text-gray-300" : "text-gray-900"
            } ${active ? "" : "border-b border-dashed border-gray-300 pb-1"}`}
          >
            {value}
            {active && (
              <span
                aria-hidden="true"
                className="caret-blink ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] rounded-full bg-brand"
              />
            )}
          </span>
          {/* The delta is the meaning — visually secondary, immediately read. */}
          {delta != null && delta !== 0 && (
            <span className="text-sm font-medium tabular-nums text-gray-400">
              ({delta > 0 ? "+" : "−"}
              {Math.abs(delta)})
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

type Props = {
  onHand: number;
  onHandActive: boolean;
  onHandHasDraft: boolean;
  onFocusOnHand: () => void;
  onUndoOnHand?: () => void;
  weekly: number;
  weeklyDelta: number;
  weeklyActive: boolean;
  weeklyHasDraft: boolean;
  onFocusWeekly: () => void;
  onUndoWeekly?: () => void;
};

// Inventory corrections — secondary by design: one quiet card, two fields,
// no chrome beyond the shared field grammar. Fast repetitive editing is the
// whole point (tap → type → done), so both fields feed the same keypad.
export function InventoryCard({
  onHand,
  onHandActive,
  onHandHasDraft,
  onFocusOnHand,
  onUndoOnHand,
  weekly,
  weeklyDelta,
  weeklyActive,
  weeklyHasDraft,
  onFocusWeekly,
  onUndoWeekly,
}: Props) {
  return (
    <section className="flex gap-6">
      <IntField
        label="On hand"
        value={onHand}
        active={onHandActive}
        hasDraft={onHandHasDraft}
        onFocus={onFocusOnHand}
        onUndo={onUndoOnHand}
      />
      <IntField
        label="Weekly units"
        value={weekly}
        active={weeklyActive}
        hasDraft={weeklyHasDraft}
        delta={weeklyDelta}
        onFocus={onFocusWeekly}
        onUndo={onUndoWeekly}
      />
    </section>
  );
}
