"use client";

type FieldProps = {
  label: string;
  value: number;
  active: boolean;
  hasDraft: boolean;
  /** Signed delta vs. the baseline ("12 (+2)") — weekly units only. */
  delta?: number | null;
  onFocus: () => void;
};

// One integer keypad target — same active/caret grammar as the price boxes,
// so "tap a value, type on the keypad" is a single skill across the screen.
function IntField({ label, value, active, hasDraft, delta, onFocus }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-brand" : "text-gray-700"}`}>{label}</span>
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={`flex items-baseline gap-1.5 rounded-lg border-2 px-3 py-1.5 text-left transition-colors ${
          active ? "border-brand bg-brand/10" : "border-gray-300 bg-gray-50"
        }`}
      >
        <span className={`text-xl font-bold tabular-nums ${active && !hasDraft ? "text-gray-400" : "text-gray-900"}`}>
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
          <span className="text-sm font-medium tabular-nums text-gray-500">
            ({delta > 0 ? "+" : "−"}
            {Math.abs(delta)})
          </span>
        )}
      </button>
    </div>
  );
}

type Props = {
  onHand: number;
  onHandActive: boolean;
  onHandHasDraft: boolean;
  onFocusOnHand: () => void;
  weekly: number;
  weeklyDelta: number;
  weeklyActive: boolean;
  weeklyHasDraft: boolean;
  onFocusWeekly: () => void;
};

// Inventory corrections — secondary by design: one quiet card, two fields,
// no chrome beyond the shared field grammar. Fast repetitive editing is the
// whole point (tap → type → done), so both fields feed the same keypad.
export function InventoryCard({
  onHand,
  onHandActive,
  onHandHasDraft,
  onFocusOnHand,
  weekly,
  weeklyDelta,
  weeklyActive,
  weeklyHasDraft,
  onFocusWeekly,
}: Props) {
  return (
    <section className="flex gap-3 rounded-xl border border-gray-300 bg-white p-3">
      <IntField label="On hand" value={onHand} active={onHandActive} hasDraft={onHandHasDraft} onFocus={onFocusOnHand} />
      <IntField
        label="Weekly units"
        value={weekly}
        active={weeklyActive}
        hasDraft={weeklyHasDraft}
        delta={weeklyDelta}
        onFocus={onFocusWeekly}
      />
    </section>
  );
}
