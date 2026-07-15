"use client";

import { useId, useRef, useState } from "react";
import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { ProductRelationship } from "@/lib/product-relationships";
import { fmt, fmtQtyPrice, fmtUnitPrice } from "@/lib/format";

type Props = {
  relationship: ProductRelationship;
  itemsById: Map<string, PricingItem>;
  /** The ids the parked proposal would reprice — the edited item plus its family. */
  changedIds: string[];
  /** The item actually being edited — gets the "This item" badge. */
  editedItemId: string | null;
  /** The parked proposal as entered: total for `proposedQty` units. */
  proposedTotal: number;
  proposedQty?: number;
  /** Card severity — drives border and proposed-price flag color. */
  tone: "hard" | "soft";
};

/**
 * Read-only "View full relationship" disclosure inside a violation card:
 * every member of the broken ladder in rank order, with the parked
 * (uncommitted) proposal rendered on the changed members. Presentation
 * mirrors ProductRelationships' member rows, but reads the proposal from
 * props instead of committed store state.
 */
export function RelationshipMembersDisclosure({
  relationship,
  itemsById,
  changedIds,
  editedItemId,
  proposedTotal,
  proposedQty,
  tone,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // The toggle is the modal's first focusable element, so the Enter that
  // committed the price would expand it on arrival. Parent keys this
  // component per proposal, so mount time == modal-open time — same 350ms
  // guard as useGuardedActions.
  const mountedAt = useRef(Date.now());

  const changed = new Set(changedIds);
  const toggleColor = tone === "hard" ? "text-red-800" : "text-amber-800";
  const panelBorder = tone === "hard" ? "border-red-200" : "border-amber-200";
  const proposedColor = tone === "hard" ? "text-red-700" : "text-amber-700";
  const FlagIcon = tone === "hard" ? AlertCircle : AlertTriangle;
  const flagColor = tone === "hard" ? "text-red-600" : "text-amber-500";

  const members = relationship.itemIds
    .map((id) => itemsById.get(id))
    .filter((m): m is PricingItem => m != null);
  if (members.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (Date.now() - mountedAt.current < 350) return;
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1 self-start text-xs font-medium ${toggleColor}`}
      >
        {open ? "Hide full relationship" : "View full relationship"}
        <ChevronDown
          className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} hidden={!open} className={`rounded-md border bg-white ${panelBorder}`}>
        {members.map((m) => {
          const isChanged = changed.has(m.id);
          const isEdited = m.id === editedItemId;
          const label = relationship.memberLabels?.[m.id];
          const price = isChanged ? (
            <span className="flex items-center justify-end gap-1.5 tabular-nums">
              <span className="text-gray-400 line-through">{fmt(m.currentBasePrice)}</span>
              <span aria-hidden="true" className="text-gray-300">→</span>
              <span className={`font-medium ${proposedColor}`}>{fmtQtyPrice(proposedQty, proposedTotal)}</span>
              <FlagIcon className={`size-3.5 shrink-0 ${flagColor}`} aria-hidden="true" />
            </span>
          ) : m.newBasePrice != null ? (
            <span className="flex items-center justify-end gap-1.5 tabular-nums">
              <span className="text-gray-400 line-through">{fmt(m.currentBasePrice)}</span>
              <span aria-hidden="true" className="text-gray-300">→</span>
              <span className="font-medium text-gray-900">{fmtQtyPrice(m.newBaseQty, m.newBasePrice)}</span>
            </span>
          ) : (
            <span className="tabular-nums text-gray-500">{fmt(m.currentBasePrice)}</span>
          );
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {label && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {label}
                    </span>
                  )}
                  <p className={`truncate text-sm ${isEdited ? "font-medium text-gray-900" : "text-gray-700"}`}>
                    {m.name}
                  </p>
                  {isEdited && <Badge tone="neutral" size="sm">This item</Badge>}
                </div>
                <p className="text-xs text-gray-500">{m.id}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                {price}
                {/* The ladder comparison is per-unit — spell out the unit price on multi-buys. */}
                {isChanged && (proposedQty ?? 1) > 1 && (
                  <p className="text-[11px] tabular-nums text-gray-500">
                    {fmtUnitPrice(proposedQty!, proposedTotal)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
