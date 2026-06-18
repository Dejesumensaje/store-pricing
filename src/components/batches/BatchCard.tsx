"use client";

import { Badge, Button } from "@dejesumensaje/converge-ds-experimental";
import { Send, CheckCircle2, Settings2, Layers } from "lucide-react";
import { Batch } from "@/types/pricing";
import { BatchImpact } from "@/lib/batch-utils";
import { fmtDate } from "@/lib/format";

const STATUS_META: Record<
  Batch["status"],
  { label: string; tone: "neutral" | "warning" | "success" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted to SAP", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
};

const signed = (v: number, suffix = "") =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}${suffix}`;

type Props = {
  batch: Batch;
  impact: BatchImpact;
  onManage: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
};

export function BatchCard({ batch, impact, onManage, onSubmit, onConfirm }: Props) {
  const status = STATUS_META[batch.status];

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-group-impact-bg text-brand">
            <Layers className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">{batch.name}</h3>
            <p className="text-xs text-gray-400">
              {impact.itemCount} item{impact.itemCount !== 1 ? "s" : ""} · created {fmtDate(batch.createdAt)}
            </p>
          </div>
        </div>
        <Badge tone={status.tone} size="sm">{status.label}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 px-4 py-3">
        <Metric label="Sales" value={signed(impact.salesValue, "M")} positive={impact.salesValue >= 0} />
        <Metric label="Margin" value={signed(impact.marginValue, "M")} positive={impact.marginValue >= 0} />
        <Metric label="Units" value={signed(impact.unitsValue, "k")} positive={impact.unitsValue >= 0} />
      </div>

      {batch.sapReference && (
        <p className="mt-3 text-xs text-gray-400">
          SAP ref <span className="font-medium text-gray-600">{batch.sapReference}</span>
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" iconLeft={Settings2} onClick={onManage}>
          Manage
        </Button>
        <div className="flex-1" />
        {batch.status === "draft" && (
          <Button variant="primary" size="sm" iconLeft={Send} onClick={onSubmit}>
            Send to SAP
          </Button>
        )}
        {batch.status === "submitted" && (
          <Button variant="secondary" size="sm" iconLeft={CheckCircle2} onClick={onConfirm}>
            Mark confirmed
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}>
        {value}
      </p>
    </div>
  );
}
