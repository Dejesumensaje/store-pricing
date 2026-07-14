"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertTriangle, Info } from "lucide-react";
import { EdlpChangeEvaluation } from "@/lib/edlp-ceiling";
import { fmt } from "@/lib/format";

type Props = {
  open: boolean;
  evaluation: EdlpChangeEvaluation | null;
  /** The originally proposed (per-unit) price — shown in the override button label. */
  proposedPrice: number;
  /** The item actually being edited — only its own soft breach gets a
   *  one-click "use the max" fix (see EdlpCeilingBlockedModal). */
  editedItemId: string | null;
  onCancel: () => void;
  /** Commit the edited item's own PMR maximum instead of the proposed price. */
  onUseMax: () => void;
  /** Commit the originally proposed price despite the warning. */
  onProceed: () => void;
};

export function EdlpCeilingWarningModal({
  open,
  evaluation,
  proposedPrice,
  editedItemId,
  onCancel,
  onUseMax,
  onProceed,
}: Props) {
  const soft = evaluation?.soft ?? [];
  const selfViolation = soft.find((v) => v.itemId === editedItemId);
  const canUseMax = selfViolation != null && selfViolation.maxAllowed < proposedPrice;

  // Same Enter-guard as BasePriceSoftWarningModal.
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
        if (!o) onCancel();
      }}
      title="Above the EDLP maximum"
      size="md"
      dismissible={false}
      showCloseButton={false}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onCancel)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={guarded(onProceed)}>
            Save {fmt(proposedPrice)} anyway
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
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span>This price is above the SAP PMR maximum, within the +10% allowance.</span>
        </div>

        {soft.map((v) => (
          <div
            key={v.itemId}
            className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning" size="sm">EDLP ceiling</Badge>
              <span className="text-sm font-medium text-gray-900">{v.itemName}</span>
              {v.exceptionActive && <Badge tone="in-progress" size="sm">Exception active</Badge>}
            </div>
            <p className="text-xs tabular-nums text-amber-900">
              {v.overHardCeiling
                ? `Proposed ${fmt(v.proposedPerUnit)} — over the hard ceiling (${fmt(v.hardCeiling)}), covered by a store exception.`
                : `Proposed ${fmt(v.proposedPerUnit)} — PMR max ${fmt(v.maxAllowed)}, within the +10% ceiling (${fmt(v.hardCeiling)}).`}
            </p>
          </div>
        ))}

        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>Contact AVP – Pricing if this needs a permanent exception.</span>
        </div>
      </div>
    </Modal>
  );
}
