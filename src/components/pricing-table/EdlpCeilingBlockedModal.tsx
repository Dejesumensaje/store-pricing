"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, Info } from "lucide-react";
import { EdlpChangeEvaluation } from "@/lib/edlp-ceiling";
import { fmt } from "@/lib/format";

type Props = {
  open: boolean;
  evaluation: EdlpChangeEvaluation | null;
  /** The item actually being edited — only its own breach gets a one-click
   *  fix; a breach on a propagated family member does not (the director
   *  would be picking someone else's price blind). */
  editedItemId: string | null;
  /** Nothing was committed — collapse back to the read-only price. */
  onRevert: () => void;
  /** Commit the edited item's own PMR maximum instead of the proposed price. */
  onUseMax: () => void;
};

export function EdlpCeilingBlockedModal({ open, evaluation, editedItemId, onRevert, onUseMax }: Props) {
  const hard = evaluation?.hard ?? [];
  const selfViolation = hard.find((v) => v.itemId === editedItemId);
  const canUseMax = hard.length === 1 && selfViolation != null;

  // Enter-guard — the keydown that triggered the commit must not immediately
  // activate a button on the newly focused modal.
  const openedAt = useRef(0);
  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open]);
  const guarded = (fn: () => void) => () => {
    if (Date.now() - openedAt.current < 350) return;
    fn();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onRevert();
      }}
      title="Price exceeds EDLP maximum"
      size="md"
      dismissible={false}
      showCloseButton={false}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onRevert)}>
            Revert
          </Button>
          {canUseMax && selfViolation && (
            <Button variant="primary" onClick={guarded(onUseMax)}>
              Use max allowed ({fmt(selfViolation.maxAllowed)})
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>This price is more than 10% over the EDLP maximum SAP PMR allows and can&apos;t be saved.</span>
        </div>

        {hard.map((v) => (
          <div
            key={v.itemId}
            className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="negative" size="sm">EDLP ceiling</Badge>
              <span className="text-sm font-medium text-gray-900">{v.itemName}</span>
            </div>
            <p className="text-xs tabular-nums text-red-900">
              Proposed {fmt(v.proposedPerUnit)} — PMR max {fmt(v.maxAllowed)}, hard ceiling {fmt(v.hardCeiling)} (+10%).
            </p>
          </div>
        ))}

        {/* Only worth summarizing when several members breach — a single
            breaching item is already fully described by its detail block. */}
        {hard.length > 1 && (
          <p className="text-xs text-red-700">Affected: {hard.map((v) => v.itemName).join(", ")}</p>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>Contact AVP – Pricing for a store-level exception.</span>
        </div>
      </div>
    </Modal>
  );
}
