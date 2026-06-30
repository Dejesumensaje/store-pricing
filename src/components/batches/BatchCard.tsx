"use client";

import { useState } from "react";
import { Badge, Button } from "@dejesumensaje/converge-ds-experimental";
import { Send, Settings2, Layers, CalendarClock, Target, Eye, ClipboardCopy, Check } from "lucide-react";
import { Batch } from "@/types/pricing";
import { BatchImpact } from "@/lib/batch-utils";
import { fmtDate, fmtImpactMoney, fmtImpactUnits } from "@/lib/format";

const STATUS_META: Record<
  Batch["status"],
  { label: string; tone: "neutral" | "warning" | "success" | "in-progress" }
> = {
  scheduled: { label: "Scheduled", tone: "in-progress" },
  submitted: { label: "Pending SAP confirmation", tone: "warning" },
  confirmed: { label: "Live", tone: "success" },
};

type Props = {
  batch: Batch;
  impact: BatchImpact;
  onManage: () => void;
  onSchedule: () => void;
  onSubmit: () => void;
  /** When provided, shows the active-batch indicator / "Set active" affordance. */
  isActive?: boolean;
  onSetActive?: () => void;
};

export function BatchCard({ batch, impact, onManage, onSchedule, onSubmit, isActive, onSetActive }: Props) {
  const status = STATUS_META[batch.status];
  const isOpen = batch.status === "scheduled";
  const [sapCopied, setSapCopied] = useState(false);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-group-impact-bg text-brand">
            <Layers className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">{batch.name}</h3>
            <p className="text-xs text-gray-500">
              {impact.itemCount} item{impact.itemCount !== 1 ? "s" : ""} · created {fmtDate(batch.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive ? (
            <Badge tone="in-progress" size="sm" icon={Target}>Active</Badge>
          ) : isOpen && onSetActive ? (
            <Button variant="tertiary" size="sm" iconLeft={Target} onClick={onSetActive}>
              Set active
            </Button>
          ) : null}
          <Badge tone={status.tone} size="sm">{status.label}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 px-4 py-3">
        <Metric label="Sales" value={fmtImpactMoney(impact.salesValue)} positive={impact.salesValue >= 0} />
        <Metric label="Margin" value={fmtImpactMoney(impact.marginValue)} positive={impact.marginValue >= 0} />
        <Metric label="Units" value={fmtImpactUnits(impact.unitsValue)} positive={impact.unitsValue >= 0} />
      </div>

      {batch.scheduledAt && batch.status === "scheduled" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarClock className="size-3.5" aria-hidden="true" /> Scheduled for {fmtDate(batch.scheduledAt)}
        </p>
      )}

      {batch.sapReference && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500">
          SAP ref{" "}
          <span className="font-mono font-medium text-gray-600">{batch.sapReference}</span>
          <button
            type="button"
            aria-label="Copy SAP reference"
            className="ml-0.5 rounded p-0.5 text-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(batch.sapReference!);
              setSapCopied(true);
              setTimeout(() => setSapCopied(false), 2000);
            }}
          >
            {sapCopied ? (
              <Check className="size-3 text-emerald-600" aria-hidden="true" />
            ) : (
              <ClipboardCopy className="size-3" aria-hidden="true" />
            )}
          </button>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" iconLeft={isOpen ? Settings2 : Eye} onClick={onManage}>
          {isOpen ? "Manage" : "Preview"}
        </Button>
        <div className="flex-1" />
        {batch.status === "scheduled" && (
          <Button variant="tertiary" size="sm" iconLeft={CalendarClock} onClick={onSchedule}>
            Reschedule
          </Button>
        )}
        {batch.status === "scheduled" && (
          <Button variant="primary" size="sm" iconLeft={Send} onClick={onSubmit}>
            Send now
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}>
        {value}
      </p>
    </div>
  );
}
