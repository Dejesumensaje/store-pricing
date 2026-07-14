"use client";

import { Modal, Button } from "@dejesumensaje/converge-ds-experimental";
import { useGuardedActions } from "@/components/shared/useGuardedActions";
import { AlertTriangle } from "lucide-react";
import { fmt, fmtQtyPrice } from "@/lib/format";

type Props = {
  open: boolean;
  proposedQty: number;
  proposedPrice: number;
  suggestedPrice: number;
  onCancel: () => void;
  onUseSuggested: () => void;
  onProceed: () => void;
};

export function RetailPriceWarningModal({
  open,
  proposedQty,
  proposedPrice,
  suggestedPrice,
  onCancel,
  onUseSuggested,
  onProceed,
}: Props) {
  const guarded = useGuardedActions(open);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title="Large price change"
      size="md"
      dismissible={false}
      showCloseButton={false}
      footer={
        // Left-to-right: escape → conscious override → recommended path (primary).
        // The override is secondary so it doesn't compete visually with the safe choice.
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onCancel)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={guarded(onProceed)}>
            Save {fmtQtyPrice(proposedQty, proposedPrice)} anyway
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
            {fmtQtyPrice(proposedQty, proposedPrice)} is a discount of more than 50% off the base price. Large discounts can significantly affect margin targets.
          </span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm text-amber-900">
            <span className="font-medium">Suggested price:</span>{" "}
            {fmt(suggestedPrice)}{" "}
            <span className="text-amber-700">(10% off base — preserves a safe margin)</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}
