"use client";

import { Modal, Button } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, Lightbulb } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { BaseChangeEvaluation, PriceWindow, RepairPlan } from "@/lib/relationship-validation";
import { fmt } from "@/lib/format";
import { useGuardedActions } from "@/components/shared/useGuardedActions";
import { BrokenLaddersSummary } from "./BrokenLaddersSummary";

type Props = {
  open: boolean;
  evaluation: BaseChangeEvaluation | null;
  itemsById: Map<string, PricingItem>;
  /** The item being edited — flagged inside the relationship panels. */
  editedItemId: string | null;
  /** The parked proposal as entered: total for `proposedQty` units. */
  proposedTotal: number;
  proposedQty?: number;
  /** Fully-valid price range for the edited item; null = no single price works. */
  window: PriceWindow | null;
  /** Minimal neighbor repair that keeps the proposed price. */
  repairPlan: RepairPlan | null;
  /** Discard the proposed price — nothing was committed. */
  onRevert: () => void;
  /** Commit `price` (per-unit) for the edited item instead of the proposal. */
  onUsePrice: (price: number) => void;
  /** Commit the proposal AND apply the repair plan to the neighbors. */
  onFixRelated: () => void;
};

/** The proposal clamped into the valid window — the "Use $X" price. */
export function clampToWindow(perUnitPrice: number, window: PriceWindow | null): number | null {
  if (!window) return null;
  if (window.min != null && perUnitPrice < window.min) return window.min;
  if (window.max != null && perUnitPrice > window.max) return window.max;
  return null; // already inside — a hard break implies this never happens
}

export function BlockedPriceChangeModal({
  open,
  evaluation,
  itemsById,
  editedItemId,
  proposedTotal,
  proposedQty,
  window,
  repairPlan,
  onRevert,
  onUsePrice,
  onFixRelated,
}: Props) {
  const hard = evaluation?.hard ?? [];
  const ladderCount = new Set(hard.map((v) => v.relationship.id)).size;
  const usePrice = clampToWindow(
    proposedQty != null && proposedQty > 1 ? proposedTotal / proposedQty : proposedTotal,
    window
  );
  const repairCount = new Set(
    (repairPlan?.changes ?? []).map((c) => c.itemId)
  ).size;
  const repairs = repairPlan ? new Map(repairPlan.changes.map((c) => [c.itemId, c.to])) : undefined;

  // The modal opens mid-keystroke: the Enter that commits the price must not
  // immediately activate a button on the newly focused modal.
  const guarded = useGuardedActions(open);

  const windowLabel =
    window == null
      ? null
      : window.min != null && window.max != null
        ? `between ${fmt(window.min)} and ${fmt(window.max)}`
        : window.min != null
          ? `at least ${fmt(window.min)}`
          : window.max != null
            ? `at most ${fmt(window.max)}`
            : null;

  return (
    <Modal
      open={open}
      // Defensive only — with dismissible={false} the DS never closes itself;
      // if that ever changes, Revert is the safe default (nothing committed).
      onOpenChange={(o) => {
        if (!o) onRevert();
      }}
      title="Price change blocked"
      size="md"
      dismissible={false}
      showCloseButton={false}
      footer={
        // Least → most recommended: discard, keep price by moving neighbors,
        // keep ladders by adjusting this price (primary).
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onRevert)}>
            Revert
          </Button>
          {repairCount > 0 && (
            <Button variant={usePrice != null ? "secondary" : "primary"} onClick={guarded(onFixRelated)}>
              Fix {repairCount} related item{repairCount === 1 ? "" : "s"}
            </Button>
          )}
          {usePrice != null && (
            <Button variant="primary" onClick={guarded(() => onUsePrice(usePrice))}>
              Use {fmt(usePrice)}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>
            You broke {ladderCount === 1 ? "a pricing ladder" : `${ladderCount} pricing ladders`}
            {" — this price can't be saved as-is."}
          </span>
        </div>

        <BrokenLaddersSummary
          // Re-key per proposal so a new parked proposal starts collapsed.
          key={proposedTotal}
          violations={hard}
          itemsById={itemsById}
          changedIds={evaluation?.changedIds ?? []}
          editedItemId={editedItemId}
          proposedTotal={proposedTotal}
          proposedQty={proposedQty}
          repairs={repairs}
          tone="hard"
        />

        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="tabular-nums">
            {windowLabel != null ? (
              <>
                To keep every ladder, price this item {windowLabel}.
                {repairCount > 0 && (
                  <> Keeping {fmt(proposedQty != null && proposedQty > 1 ? proposedTotal / proposedQty : proposedTotal)} instead moves {repairCount} related item{repairCount === 1 ? "" : "s"} — expand a ladder above to preview.</>
                )}
              </>
            ) : (
              <>No single price satisfies every ladder — fix the related items instead (expand a ladder above to preview).</>
            )}
          </span>
        </div>
      </div>
    </Modal>
  );
}
