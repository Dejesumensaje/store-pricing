"use client";

import { Modal, Button } from "@dejesumensaje/converge-ds-experimental";
import { AlertTriangle, Info } from "lucide-react";
import { BaseChangeEvaluation } from "@/lib/relationship-validation";
import { PricingItem } from "@/types/pricing";
import { fmt } from "@/lib/format";
import { useGuardedActions } from "@/components/shared/useGuardedActions";
import { BrokenLaddersSummary } from "./BrokenLaddersSummary";

type Props = {
  open: boolean;
  evaluation: BaseChangeEvaluation | null;
  /** The originally proposed (per-unit) price — shown in the override button label. */
  proposedPrice: number;
  /** Price that satisfies every violated gap — the least-intrusive valid price. */
  suggestedPrice: number;
  itemsById: Map<string, PricingItem>;
  /** The item being edited — flagged inside the relationship panels. */
  editedItemId: string | null;
  /** The parked proposal as entered: total for `proposedQty` units. */
  proposedTotal: number;
  proposedQty?: number;
  onCancel: () => void;
  /** Commit the suggested price instead of the proposed one. */
  onUseSuggested: () => void;
  /** Commit the originally proposed price despite the warning. */
  onProceed: () => void;
};

export function BasePriceSoftWarningModal({
  open,
  evaluation,
  proposedPrice,
  suggestedPrice,
  itemsById,
  editedItemId,
  proposedTotal,
  proposedQty,
  onCancel,
  onUseSuggested,
  onProceed,
}: Props) {
  const soft = evaluation?.soft ?? [];
  const ladderCount = new Set(soft.map((v) => v.relationship.id)).size;

  // Same Enter-guard as BlockedPriceChangeModal — the keydown that triggered
  // the commit must not immediately activate a button on the newly focused modal.
  const guarded = useGuardedActions(open);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title="Narrow pricing gap"
      size="md"
      dismissible={false}
      showCloseButton={false}
      footer={
        // Left-to-right: escape → conscious override (names the price) → recommended path (primary).
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onCancel)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={guarded(onProceed)}>
            Save {fmt(proposedPrice)} anyway
          </Button>
          <Button variant="primary" onClick={guarded(onUseSuggested)}>
            Use {fmt(suggestedPrice)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span>
            This price leaves a narrow gap in{" "}
            {ladderCount === 1 ? "a pricing ladder" : `${ladderCount} pricing ladders`}.
          </span>
        </div>

        <BrokenLaddersSummary
          // Re-key per proposal so a new parked proposal starts collapsed.
          key={proposedTotal}
          violations={soft}
          itemsById={itemsById}
          changedIds={evaluation?.changedIds ?? []}
          editedItemId={editedItemId}
          proposedTotal={proposedTotal}
          proposedQty={proposedQty}
          tone="soft"
        />

        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>
            <span className="font-medium text-gray-700">Use {fmt(suggestedPrice)}</span> — keeps every
            gap within its required minimum.
          </span>
        </div>
      </div>
    </Modal>
  );
}
