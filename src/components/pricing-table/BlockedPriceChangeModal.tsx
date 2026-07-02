"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, Info } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { RELATIONSHIP_META } from "@/lib/product-relationships";
import { BaseChangeEvaluation } from "@/lib/relationship-validation";
import { fmtSignedPct } from "@/lib/pricing-math";

type Props = {
  open: boolean;
  evaluation: BaseChangeEvaluation | null;
  itemsById: Map<string, PricingItem>;
  /** Discard the proposed price — nothing was committed. */
  onRevert: () => void;
  /** Commit the proposal AND apply the same % delta to the affected SKUs. */
  onScale: () => void;
};

export function BlockedPriceChangeModal({ open, evaluation, itemsById, onRevert, onScale }: Props) {
  const hard = evaluation?.hard ?? [];
  const targets = evaluation?.scaleTargets ?? [];
  const canScale = targets.length > 0;

  // The modal opens mid-keystroke: the Enter that commits the price moves
  // focus onto these buttons before the key is released, and the browser
  // delivers that same Enter as a click on the newly focused button. Ignore
  // activations in the first beat after opening (also covers a held Enter).
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
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={guarded(onRevert)}>
            Revert price change
          </Button>
          {canScale && (
            <Button variant="primary" onClick={guarded(onScale)}>
              Scale to related SKUs
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>
            This change breaks {hard.length} pricing fundamental{hard.length === 1 ? "" : "s"} and
            cannot be saved as-is.
          </span>
        </div>

        {hard.map((v) => (
          <div
            key={`${v.relationship.id}:${v.offenderId}:${v.comparatorId}`}
            className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="negative" size="sm">{RELATIONSHIP_META[v.relationship.type].label}</Badge>
              <span className="text-sm font-medium text-gray-900">{v.relationship.name}</span>
            </div>
            <p className="text-xs tabular-nums text-red-900">{v.message}</p>
            <p className="text-xs text-red-700">
              Affected:{" "}
              {v.affectedIds
                .map((id) => itemsById.get(id)?.name)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ))}

        {canScale && evaluation && (
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="tabular-nums">
              <span className="font-medium text-gray-700">Scale to related SKUs</span> — applies the
              same {fmtSignedPct(evaluation.deltaPct)} to the {targets.length} affected SKU
              {targets.length === 1 ? "" : "s"}.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
