"use client";

import { useEffect, useState } from "react";
import { Modal, Button } from "@dejesumensaje/converge-ds-experimental";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Batch } from "@/types/pricing";

type Phase = "confirm" | "loading" | "result";

type Props = {
  batch: Batch | null;
  itemCount: number;
  onOpenChange: (open: boolean) => void;
  /** Commit the send (e.g. submitBatch). Called once the simulated round-trip ends. */
  onSend: (batchId: string) => void;
};

// Send-to-SAP flow with a confirm → loading → result sequence, so the user gets
// clear feedback instead of a silent state change.
export function SendToSapModal({ batch, itemCount, onOpenChange, onSend }: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");

  useEffect(() => {
    if (batch) setPhase("confirm");
  }, [batch?.id]);

  const start = () => {
    if (!batch) return;
    setPhase("loading");
    setTimeout(() => {
      onSend(batch.id);
      setPhase("result");
    }, 1200);
  };

  const close = () => onOpenChange(false);

  return (
    <Modal
      open={batch != null}
      onOpenChange={(o) => !o && close()}
      title="Send to SAP"
      size="sm"
      className="max-md:!max-w-[calc(100vw-1.5rem)]"
      dismissible={phase !== "loading"}
      showCloseButton={phase !== "loading"}
      footer={
        phase === "confirm" ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="primary" iconLeft={Send} onClick={start}>Send to SAP</Button>
          </div>
        ) : phase === "result" ? (
          <div className="flex justify-end">
            <Button variant="primary" onClick={close}>Done</Button>
          </div>
        ) : undefined
      }
    >
      {batch && phase === "confirm" && (
        <p className="text-sm text-gray-600">
          Send all {itemCount} price change{itemCount !== 1 ? "s" : ""} in{" "}
          <span className="font-medium text-gray-900">“{batch.name}”</span> to SAP now? New edits made after
          sending create fresh pending changes.
        </p>
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
          <Loader2 className="size-8 animate-spin text-brand" />
          <p className="text-sm font-medium">Sending to SAP…</p>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="text-sm font-semibold text-gray-900">Sent to SAP</p>
          <p className="text-xs text-gray-500">
            Pending confirmation from SAP. The price goes live once SAP confirms it.
          </p>
        </div>
      )}
    </Modal>
  );
}
