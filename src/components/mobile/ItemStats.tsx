"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

type Projection = { lo: number; hi: number };

// A read-only figure — bare label + numeral, no dashed underline, caret or tap
// target. The missing edit affordance is the signal: these are reported, not
// decided here. Weekly units carries an optional projection: the estimated unit
// sales range under a drafted price change, sitting inline to the right of the
// current value. Direction is colored — green when the change lifts volume, red
// when it trims it — so the trade-off reads at a glance. When a valid price is
// drafted but the shelf doesn't actually move (a sub-threshold change, or a base
// edit under an active deal), the slot holds a neutral "≈ no change" instead of
// blanking — the estimate never silently disappears mid-edit. An INVALID price
// shows neither: the error strip owns the row until it's resolved.
function StatField({
  label,
  value,
  projection,
  flat,
}: {
  label: string;
  value: number;
  projection?: Projection | null;
  flat?: boolean;
}) {
  const up = projection ? (projection.lo + projection.hi) / 2 >= value : false;
  const Trend = up ? TrendingUp : TrendingDown;
  const tone = up ? "text-emerald-700" : "text-red-600";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <div className="flex min-w-0 items-baseline gap-1.5 py-0.5">
        <span className="text-[22px] font-semibold leading-none tabular-nums text-gray-900">{value}</span>
        {projection ? (
          <span className={`rise-in flex min-w-0 items-center gap-1 text-sm font-medium tabular-nums ${tone}`}>
            <Trend className="size-3.5 shrink-0" aria-hidden="true" />
            {projection.lo === projection.hi ? `~${projection.lo}` : `${projection.lo}–${projection.hi}`}
            <span className="text-[11px] font-normal text-gray-400">est./wk</span>
          </span>
        ) : flat ? (
          <span className="rise-in flex min-w-0 items-center gap-1 text-sm font-medium text-gray-400">
            ≈ no change
          </span>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  onHand: number;
  weekly: number;
  /** Estimated weekly unit sales under a drafted price change — null at rest. */
  weeklyProjection?: Projection | null;
  /** A valid price is drafted but the shelf doesn't move → show "≈ no change"
      rather than blanking the slot. Ignored while a projection is present. */
  weeklyFlat?: boolean;
};

// Two read-only figures side by side: On hand (units in stock) and Weekly units
// (unit sales velocity). Neither is editable — the walk reports them. A drafted
// price change annotates Weekly units with its projected sales range (or a
// neutral "≈ no change" when the price is valid but the shelf doesn't move).
export function ItemStats({ onHand, weekly, weeklyProjection, weeklyFlat }: Props) {
  return (
    <section className="flex gap-6">
      <StatField label="On hand" value={onHand} />
      <StatField label="Weekly units" value={weekly} projection={weeklyProjection} flat={weeklyFlat} />
    </section>
  );
}
