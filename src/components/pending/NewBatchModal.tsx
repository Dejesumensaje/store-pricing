"use client";

import { useMemo, useState, useEffect } from "react";
import { Button, Modal, Checkbox, Input, SearchInput, Badge } from "@dejesumensaje/converge-ds-experimental";
import { Store as StoreIcon, ChevronDown, AlertTriangle, Ban, Lock } from "lucide-react";
import { Override } from "@/types/pricing";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";
import { DateField, todayIso } from "@/components/shared/DateField";
import { TimeField, DEFAULT_SEND_TIME } from "@/components/shared/TimeField";
import { STORES } from "@/lib/store-config";
import { usePricingStore } from "@/store/pricing-store";
import { buildFanoutSources, planFanout, StorePlan } from "@/lib/store-fanout";

export function toggleSetItem(
  prev: Set<string>,
  id: string,
  checked: boolean | "indeterminate"
): Set<string> {
  const next = new Set(prev);
  checked === true ? next.add(id) : next.delete(id);
  return next;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending overrides available to group into the new batch. */
  candidates: Override[];
  /** Override ids pre-checked when the modal opens. */
  initialSelectedIds?: string[];
  /** Every batch is scheduled at creation — `scheduledAt` is `YYYY-MM-DDTHH:mm:00`. */
  onCreate: (name: string, overrideIds: string[], scheduledAt: string, targetStoreIds: string[]) => void;
};

// Shared by the pending-changes drawer and the Loose Tray page.
export function NewBatchModal({ open, onOpenChange, candidates, initialSelectedIds, onCreate }: Props) {
  const activeStoreId = usePricingStore((s) => s.activeStoreId);
  const activeItems = usePricingStore((s) => s.items);
  const activeOverrides = usePricingStore((s) => s.overrides);
  const stash = usePricingStore((s) => s.stash);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Which of the director's stores this batch applies to (always ≥ the active one).
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set([activeStoreId]));
  const [showBreakdown, setShowBreakdown] = useState(false);
  // A batch must be scheduled (date + time) — both required to create.
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSearch("");
      setChecked(new Set(initialSelectedIds ?? []));
      setTargetIds(new Set([activeStoreId]));
      setShowBreakdown(false);
      setDate(todayIso());
      setTime(DEFAULT_SEND_TIME);
      setPastError(null);
    }
  }, [open, initialSelectedIds, activeStoreId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter((o) => o.itemName.toLowerCase().includes(q));
  }, [candidates, search]);

  // Fan-out preview: how the checked changes land in each selected store.
  const summary = useMemo(() => {
    const selected = candidates.filter((o) => checked.has(o.id));
    if (selected.length === 0) return null;
    const sources = buildFanoutSources(selected, activeItems);
    const targets = STORES.filter((s) => targetIds.has(s.id)).map((s) => s.id);
    return planFanout(
      sources,
      targets,
      activeStoreId,
      { items: activeItems, overrides: activeOverrides, batches: [] },
      stash
    );
  }, [candidates, checked, targetIds, activeItems, activeOverrides, stash, activeStoreId]);

  const multiStore = targetIds.size > 1;
  const canCreate = !!name.trim() && checked.size > 0 && !!date && !!time && targetIds.size > 0;
  const handleCreate = () => {
    if (!canCreate) return;
    const scheduledAt = `${date}T${time}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      setPastError("Send time is in the past");
      return;
    }
    setPastError(null);
    onCreate(name.trim(), Array.from(checked), scheduledAt, Array.from(targetIds));
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New batch"
      size="md"
      className="max-md:!max-w-[calc(100vw-1.5rem)]"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
            {multiStore
              ? `Create batch · ${targetIds.size} stores (${checked.size} change${checked.size !== 1 ? "s" : ""})`
              : `Create batch (${checked.size} item${checked.size !== 1 ? "s" : ""})`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Batch name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tuesday, ad prep"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Send schedule</p>
          <div className="flex items-center gap-2">
            <DateField
              value={date}
              onChange={(v) => { setDate(v); setPastError(null); }}
              min={todayIso()}
              aria-label="Send date"
            />
            <TimeField
              value={time}
              onChange={(v) => { setTime(v); setPastError(null); }}
              aria-label="Send time"
            />
          </div>
          {pastError && (
            <p className="text-xs text-red-600">{pastError}</p>
          )}
          <p className="text-xs text-gray-500">The batch sends to SAP automatically at this date and time.</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Select items to include</p>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            aria-label="Search items for batch"
            className="mb-2 w-full"
          />
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No pending items available.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {filtered.map((ov) => (
                <label
                  key={ov.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                    checked.has(ov.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked.has(ov.id)}
                    onCheckedChange={(c) => setChecked((prev) => toggleSetItem(prev, ov.id, c))}
                    aria-label={ov.itemName}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ov.itemName}</p>
                    <p className="text-xs text-gray-500">
                      {CATEGORY_LABELS[ov.changeType]} · {ov.priceField === "base" ? "Base" : "Retail"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    <span className="text-gray-500">{fmt(ov.currentPrice)}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-semibold text-gray-700">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
          {checked.size > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              {checked.size} item{checked.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* ── Apply to stores (multi-store fan-out) ─────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Apply to stores</p>
            <button
              type="button"
              className="text-xs font-medium text-brand hover:underline"
              onClick={() =>
                setTargetIds((prev) =>
                  prev.size === STORES.length ? new Set([activeStoreId]) : new Set(STORES.map((s) => s.id))
                )
              }
            >
              {targetIds.size === STORES.length ? "Just this store" : "All my stores"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {STORES.map((store) => {
              const isActive = store.id === activeStoreId;
              return (
                <label
                  key={store.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                    targetIds.has(store.id) ? "border-brand/40 bg-brand/5" : "border-gray-200"
                  } ${isActive ? "" : "cursor-pointer hover:bg-gray-50"}`}
                >
                  <Checkbox
                    checked={targetIds.has(store.id)}
                    disabled={isActive}
                    onCheckedChange={(c) => setTargetIds((prev) => toggleSetItem(prev, store.id, c))}
                    aria-label={store.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">{store.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {isActive ? "This store" : store.address}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {multiStore && summary && (
            <FanoutPreview
              summary={summary}
              expanded={showBreakdown}
              onToggle={() => setShowBreakdown((v) => !v)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

// Live preview of how the changes fan out: a headline of clean/overwrite/skipped
// counts plus an expandable per-store breakdown so the confirmation is explicit.
function FanoutPreview({
  summary,
  expanded,
  onToggle,
}: {
  summary: ReturnType<typeof planFanout>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { cleanStores, totalStores, totalConflicts, totalMissing, totalLocked } = summary;
  const hasExceptions = totalConflicts > 0 || totalMissing > 0 || totalLocked > 0;
  return (
    <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium text-gray-700">
          Applies cleanly in {cleanStores} of {totalStores} store{totalStores !== 1 ? "s" : ""}
        </span>
        {totalConflicts > 0 && (
          <Badge tone="warning" size="sm">
            {totalConflicts} overwrite{totalConflicts !== 1 ? "s" : ""}
          </Badge>
        )}
        {totalMissing > 0 && (
          <Badge tone="neutral" size="sm">
            {totalMissing} SKU missing
          </Badge>
        )}
        {totalLocked > 0 && (
          <Badge tone="neutral" size="sm">
            {totalLocked} in flight
          </Badge>
        )}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        {expanded ? "Hide" : "Show"} per-store detail
      </button>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-2">
          {summary.perStore.map(({ storeId, plan }) => (
            <StoreRow key={storeId} storeId={storeId} plan={plan} />
          ))}
        </ul>
      )}
      {hasExceptions && (
        <p className="mt-2 text-[11px] leading-snug text-gray-500">
          Conflicting changes are overwritten with this price. Missing SKUs and in-flight changes are skipped.
        </p>
      )}
    </div>
  );
}

function StoreRow({ storeId, plan }: { storeId: string; plan: StorePlan }) {
  const store = STORES.find((s) => s.id === storeId);
  const clean = plan.conflicts.length === 0 && plan.missing.length === 0 && plan.locked.length === 0;
  return (
    <li className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-800">
          <StoreIcon className="size-3.5 text-gray-400" aria-hidden="true" />
          {store?.name ?? storeId}
        </span>
        <span className="text-[11px] text-gray-500">{plan.applied.length + plan.conflicts.length} applied</span>
      </div>
      {!clean && (
        <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-gray-600">
          {plan.conflicts.map((e) => (
            <span key={`c-${e.itemId}-${e.priceField}`} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3 shrink-0 text-amber-500" aria-hidden="true" />
              <span className="truncate">Overwrites {e.itemName}</span>
            </span>
          ))}
          {plan.missing.map((e) => (
            <span key={`m-${e.itemId}`} className="flex items-center gap-1.5">
              <Ban className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="truncate">Skipped {e.itemName} — SKU not in this store</span>
            </span>
          ))}
          {plan.locked.map((e) => (
            <span key={`l-${e.itemId}-${e.priceField}`} className="flex items-center gap-1.5">
              <Lock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="truncate">Skipped {e.itemName} — a change is already in flight</span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
