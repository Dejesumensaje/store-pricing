"use client";

import { useState } from "react";
import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { ProductRelationship, RELATIONSHIP_META } from "@/lib/product-relationships";
import { Violation } from "@/lib/relationship-validation";
import { fmt, fmtQtyPrice, fmtUnitPrice } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { useGuardedActions } from "@/components/shared/useGuardedActions";

type Props = {
  /** One severity at a time — the blocked modal passes hard, the warning modal soft. */
  violations: Violation[];
  itemsById: Map<string, PricingItem>;
  /** The ids the parked proposal would reprice — the edited item plus its family. */
  changedIds: string[];
  /** The item actually being edited — gets the "This item" badge. */
  editedItemId: string | null;
  /** The parked proposal as entered: total for `proposedQty` units. */
  proposedTotal: number;
  proposedQty?: number;
  /** Planned per-unit repair prices ("Fix related items" preview), keyed by item id. */
  repairs?: Map<string, number>;
  tone: "hard" | "soft";
};

// Above this many members a panel opens on the break's neighborhood (the
// involved rows ± one) instead of the full list — relationships can span
// dozens of items and the modal must not.
const WINDOW_THRESHOLD = 8;

type Group = {
  relationship: ProductRelationship;
  violations: Violation[];
  /** Unique other-members impacted by this break — the pill's count. */
  affectedCount: number;
};

/**
 * Compact "you broke these" summary for both ladder modals: one pill per
 * broken relationship (type label + affected-item count); tapping a pill
 * expands that relationship's member list. Lists are windowed to the break's
 * neighborhood past WINDOW_THRESHOLD, with a "Show all" that scrolls
 * internally — a 200-member relationship never renders 200 rows unasked.
 */
export function BrokenLaddersSummary({
  violations,
  itemsById,
  changedIds,
  editedItemId,
  proposedTotal,
  proposedQty,
  repairs,
  tone,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // The modal opens mid-keystroke: the Enter that committed the price must
  // not immediately toggle the first pill. Parent keys this component per
  // proposal, so mount time == modal-open time (same guard as the footer).
  const guarded = useGuardedActions(true);

  const groups: Group[] = [];
  for (const v of violations) {
    const g = groups.find((x) => x.relationship.id === v.relationship.id);
    if (g) g.violations.push(v);
    else groups.push({ relationship: v.relationship, violations: [v], affectedCount: 0 });
  }
  for (const g of groups) {
    g.affectedCount = new Set(g.violations.flatMap((v) => v.affectedIds)).size;
  }

  const toggle = (relId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(relId)) next.delete(relId);
      else next.add(relId);
      return next;
    });
  };

  const pill =
    tone === "hard"
      ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
      : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  const count = tone === "hard" ? "bg-red-600" : "bg-amber-500";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {groups.map((g) => {
          const open = expanded.has(g.relationship.id);
          return (
            <button
              key={g.relationship.id}
              type="button"
              aria-expanded={open}
              aria-controls={`ladder-panel-${g.relationship.id}`}
              onClick={guarded(() => toggle(g.relationship.id))}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${pill}`}
            >
              {RELATIONSHIP_META[g.relationship.type].label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 text-white ${count}`}>
                {g.affectedCount}
              </span>
              <ChevronDown
                className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {groups
        .filter((g) => expanded.has(g.relationship.id))
        .map((g) => (
          <MembersPanel
            key={g.relationship.id}
            group={g}
            itemsById={itemsById}
            changedIds={changedIds}
            editedItemId={editedItemId}
            proposedTotal={proposedTotal}
            proposedQty={proposedQty}
            repairs={repairs}
            tone={tone}
          />
        ))}
    </div>
  );
}

function MembersPanel({
  group,
  itemsById,
  changedIds,
  editedItemId,
  proposedTotal,
  proposedQty,
  repairs,
  tone,
}: {
  group: Group;
  itemsById: Map<string, PricingItem>;
  changedIds: string[];
  editedItemId: string | null;
  proposedTotal: number;
  proposedQty?: number;
  repairs?: Map<string, number>;
  tone: "hard" | "soft";
}) {
  const [showAll, setShowAll] = useState(false);
  const { relationship } = group;

  const members = relationship.itemIds
    .map((id) => itemsById.get(id))
    .filter((m): m is PricingItem => m != null);
  if (members.length === 0) return null;

  // The rows that matter to THIS break: the repriced items plus each
  // violation's two sides. The window shows them with one neighbor of
  // context on each end.
  const involved = new Set([
    ...changedIds,
    ...group.violations.flatMap((v) => [v.offenderId, v.comparatorId]),
    ...(repairs ? relationship.itemIds.filter((id) => repairs.has(id)) : []),
  ]);
  const involvedIdx = members.flatMap((m, i) => (involved.has(m.id) ? [i] : []));
  const windowed = members.length > WINDOW_THRESHOLD && !showAll;
  const start = windowed ? Math.max(0, Math.min(...involvedIdx) - 1) : 0;
  const end = windowed ? Math.min(members.length, Math.max(...involvedIdx) + 2) : members.length;

  const panelBorder = tone === "hard" ? "border-red-200" : "border-amber-200";
  const headerText = tone === "hard" ? "text-red-800" : "text-amber-800";

  return (
    <div
      id={`ladder-panel-${relationship.id}`}
      className={`overflow-hidden rounded-lg border bg-white ${panelBorder}`}
    >
      <div className={`flex items-baseline justify-between gap-2 border-b border-gray-100 px-3 py-1.5 text-xs ${headerText}`}>
        <span className="font-medium">
          {RELATIONSHIP_META[relationship.type].label}
          <span className="font-normal opacity-70"> · {relationship.name}</span>
        </span>
        <span className="shrink-0 tabular-nums opacity-70">{members.length} items</span>
      </div>
      <div className={showAll ? "max-h-64 overflow-y-auto" : undefined}>
        {windowed && start > 0 && <SkippedRow count={start} side="above" />}
        {members.slice(start, end).map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            label={relationship.memberLabels?.[m.id]}
            changed={changedIds.includes(m.id)}
            isEdited={m.id === editedItemId}
            proposedTotal={proposedTotal}
            proposedQty={proposedQty}
            repairTo={repairs?.get(m.id)}
            tone={tone}
          />
        ))}
        {windowed && end < members.length && <SkippedRow count={members.length - end} side="below" />}
      </div>
      {members.length > WINDOW_THRESHOLD && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {showAll ? "Show fewer items" : `Show all ${members.length} items`}
        </button>
      )}
    </div>
  );
}

// A member's pending-or-live per-unit base — the price a repair moves from.
function effectiveBase(m: PricingItem): number {
  return m.newBasePrice != null ? perUnit(m.newBasePrice, m.newBaseQty) : m.currentBasePrice;
}

function SkippedRow({ count, side }: { count: number; side: "above" | "below" }) {
  return (
    <div className="border-b border-gray-100 px-3 py-1 text-[11px] text-gray-400 last:border-0">
      ⋮ {count} item{count === 1 ? "" : "s"} {side}
    </div>
  );
}

function MemberRow({
  member,
  label,
  changed,
  isEdited,
  proposedTotal,
  proposedQty,
  repairTo,
  tone,
}: {
  member: PricingItem;
  label?: string;
  changed: boolean;
  isEdited: boolean;
  proposedTotal: number;
  proposedQty?: number;
  /** Planned per-unit price if "Fix related items" is chosen — preview only. */
  repairTo?: number;
  tone: "hard" | "soft";
}) {
  const proposedColor = tone === "hard" ? "text-red-700" : "text-amber-700";
  const FlagIcon = tone === "hard" ? AlertCircle : AlertTriangle;
  const flagColor = tone === "hard" ? "text-red-600" : "text-amber-500";

  const price = changed ? (
    <span className="flex items-center justify-end gap-1.5 tabular-nums">
      <span className="text-gray-400 line-through">{fmt(member.currentBasePrice)}</span>
      <span aria-hidden="true" className="text-gray-300">→</span>
      <span className={`font-medium ${proposedColor}`}>{fmtQtyPrice(proposedQty, proposedTotal)}</span>
      <FlagIcon className={`size-3.5 shrink-0 ${flagColor}`} aria-hidden="true" />
    </span>
  ) : repairTo != null ? (
    <span className="flex items-center justify-end gap-1.5 tabular-nums">
      <span className="text-gray-400 line-through">{fmt(effectiveBase(member))}</span>
      <span aria-hidden="true" className="text-gray-300">→</span>
      <span className="font-medium text-gray-700">{fmt(repairTo)}</span>
    </span>
  ) : member.newBasePrice != null ? (
    <span className="flex items-center justify-end gap-1.5 tabular-nums">
      <span className="text-gray-400 line-through">{fmt(member.currentBasePrice)}</span>
      <span aria-hidden="true" className="text-gray-300">→</span>
      <span className="font-medium text-gray-900">{fmtQtyPrice(member.newBaseQty, member.newBasePrice)}</span>
    </span>
  ) : (
    <span className="tabular-nums text-gray-500">{fmt(member.currentBasePrice)}</span>
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {label && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {label}
            </span>
          )}
          <p className={`truncate text-sm ${isEdited ? "font-medium text-gray-900" : "text-gray-700"}`}>
            {member.name}
          </p>
          {isEdited && <Badge tone="neutral" size="sm">This item</Badge>}
        </div>
        <p className="text-xs text-gray-500">{member.id}</p>
      </div>
      <div className="shrink-0 text-right text-sm">
        {price}
        {/* The ladder comparison is per-unit — spell out the unit price on multi-buys. */}
        {changed && (proposedQty ?? 1) > 1 && (
          <p className="text-[11px] tabular-nums text-gray-500">
            {fmtUnitPrice(proposedQty!, proposedTotal)}
          </p>
        )}
        {!changed && repairTo != null && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">after fix</p>
        )}
      </div>
    </div>
  );
}
