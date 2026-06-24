"use client";

import { useMemo, useState } from "react";
import { Button, Badge, Checkbox, Select, Tooltip, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Check, X, ChevronRight, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { BatchSplitButton } from "./BatchSplitButton";
import { usePricingStore } from "@/store/pricing-store";
import { hqReviewNeeded } from "@/lib/item-status";
import { hqRecRationale } from "@/lib/hq-rec";
import { shelfTagKind, SHELF_TAG_META } from "./buildStoreColumns";
import { PricingItem, Batch } from "@/types/pricing";
import { fmt } from "@/lib/format";

// HQ can send a lot — so review is a scannable WORKLIST, not a 1-by-1 march:
// see everything at once (context + patterns), accept/skip inline, accept in
// bulk, and dive into the full card only for the ones that need a closer look.
// Accepting feeds the "To send" queue — review decides prices; batching (which
// SAP send group, when) happens on the To-send surface this hands off to.
type Props = {
  onExit: () => void;
  /** Open an item's full proposal card (the drawer) for a closer look. */
  onOpenItem: (id: string) => void;
  /** Go to the To-send surface to sort the accepted changes into batches. */
  onGoToSend: () => void;
  openBatches: Batch[];
  activeBatch: Batch | null;
  /** Assign override ids to a batch (owned by the page). */
  onAddToBatch: (batchId: string, overrideIds: string[]) => void;
  onNewBatch: (seedIds: string[]) => void;
};

type SortKey = "attention" | "tag" | "item";

// The proposed move for a row, resolved to the field that matters.
function proposal(item: PricingItem) {
  const isTemp = item.category_type === "temporary_allowance";
  const current = isTemp ? item.currentRetailPrice ?? item.currentBasePrice : item.currentBasePrice;
  const proposed = isTemp ? item.recommendedRetailPrice ?? item.currentBasePrice : item.recommendedBasePrice;
  const pct = current > 0 ? Math.round(((proposed - current) / current) * 100) : 0;
  // Worth a closer look: an alert, or a big swing.
  const flagged = !!item.hasAlert || Math.abs(pct) >= 15;
  return { current, proposed, pct, flagged };
}

export function ReviewFlow({ onExit, onOpenItem, onGoToSend, openBatches, activeBatch, onAddToBatch, onNewBatch }: Props) {
  const items = usePricingStore((s) => s.items);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const toast = useToast();

  const [totalAtEntry] = useState(() => items.filter(hqReviewNeeded).length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("attention");

  // The override id an accept produces (retail for a promo, base otherwise).
  const overrideIdFor = (item: PricingItem) =>
    `${item.id}:${item.category_type === "temporary_allowance" ? "retail" : "base"}`;

  // Live queue — rows leave as you decide; the list drains under you.
  const queue = useMemo(() => {
    const list = items.filter(hqReviewNeeded);
    const tagRank: Record<string, number> = { yellow: 0, clearance: 1, new: 2, edlp: 3, white: 4 };
    return [...list].sort((a, b) => {
      if (sort === "tag") return (tagRank[shelfTagKind(a)] ?? 9) - (tagRank[shelfTagKind(b)] ?? 9);
      if (sort === "item") return a.name.localeCompare(b.name);
      // attention: flagged first, then biggest swing
      const pa = proposal(a);
      const pb = proposal(b);
      return Number(pb.flagged) - Number(pa.flagged) || Math.abs(pb.pct) - Math.abs(pa.pct);
    });
  }, [items, sort]);

  const decided = totalAtEntry - queue.length;
  const readyCount = useMemo(
    () => items.filter((i) => i.baseOverrideStatus === "pending" || i.retailOverrideStatus === "pending").length,
    [items]
  );

  const acceptOne = (item: PricingItem) => {
    if (item.category_type === "temporary_allowance") {
      updateRetailPrice(item.id, 1, item.recommendedRetailPrice ?? item.currentBasePrice);
    } else {
      updateBasePrice(item.id, item.recommendedBasePrice);
    }
  };
  const acceptMany = (list: PricingItem[]) => {
    list.forEach(acceptOne);
    setSelected(new Set());
    toast.success(`${list.length} accepted`, { description: "Added to To send." });
  };
  // Accept the selected recs AND drop them straight into a batch — for directors
  // who sort as they review (the alternative to batching later on To send).
  const acceptSelectedToBatch = (batchId: string) => {
    const list = queue.filter((i) => selected.has(i.id));
    list.forEach(acceptOne);
    onAddToBatch(batchId, list.map(overrideIdFor));
    setSelected(new Set());
  };
  const skipOne = (item: PricingItem) => acceptNoChange(item.id);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── End of the queue: hand off to To send (where batching happens) ──────────
  if (queue.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <CheckCircle2 className="size-14 text-emerald-500" aria-hidden="true" />
        <h2 className="text-xl font-bold text-gray-900">
          {totalAtEntry === 0 ? "No recommendations to review" : "All reviewed"}
        </h2>
        <p className="max-w-[320px] text-sm text-gray-500">
          {readyCount > 0
            ? `${readyCount} ${readyCount === 1 ? "change is" : "changes are"} now in To send. Sort them into batches to control when they reach SAP.`
            : "Nothing was accepted — nothing to send."}
        </p>
        {readyCount > 0 && (
          <Button variant="primary" iconRight={ArrowRight} onClick={onGoToSend} className="mt-1">
            Go to To send
          </Button>
        )}
        <Button variant="tertiary" onClick={onExit}>Back to all items</Button>
      </div>
    );
  }

  const allSelected = queue.length > 0 && queue.every((i) => selected.has(i.id));

  return (
    <div>
      {/* Header — progress + exit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review from HQ</h2>
          <p className="text-sm text-gray-500">
            <span className="tabular-nums">{decided}</span> decided ·{" "}
            <span className="font-medium text-gray-700 tabular-nums">{queue.length}</span> to go
          </p>
        </div>
        <div className="flex items-center gap-3">
          {readyCount > 0 && (
            <button type="button" onClick={onGoToSend} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              <Check className="size-4" aria-hidden="true" /> {readyCount} in To send
            </button>
          )}
          <Button variant="tertiary" size="sm" iconLeft={X} onClick={onExit}>Exit review</Button>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${totalAtEntry ? (decided / totalAtEntry) * 100 : 0}%` }} />
      </div>

      {/* Bulk bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(queue.map((i) => i.id)))} aria-label="Select all" />
          <span className="text-sm text-gray-600">
            {selected.size > 0 ? `${selected.size} selected` : `Select`}
          </span>
          <div className="w-40">
            <Select
              size="sm"
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { label: "Needs attention", value: "attention" },
                { label: "Tag", value: "tag" },
                { label: "Item name", value: "item" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <BatchSplitButton
                size="sm"
                activeBatch={activeBatch}
                openBatches={openBatches}
                onAddToActive={() => activeBatch && acceptSelectedToBatch(activeBatch.id)}
                onAddToBatch={(id) => acceptSelectedToBatch(id)}
                onNewBatch={() => { acceptMany(queue.filter((i) => selected.has(i.id))); onGoToSend(); }}
              />
              <Button variant="secondary" size="sm" iconLeft={Check} onClick={() => acceptMany(queue.filter((i) => selected.has(i.id)))}>
                Accept ({selected.size})
              </Button>
            </>
          )}
          <Button variant="primary" size="sm" iconLeft={Check} onClick={() => acceptMany(queue)}>
            Accept all {queue.length}
          </Button>
        </div>
      </div>

      {/* Worklist */}
      <ul className="mt-3 flex flex-col gap-2">
        {queue.map((item) => {
          const { current, proposed, pct, flagged } = proposal(item);
          const meta = SHELF_TAG_META[shelfTagKind(item)];
          return (
            <li key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} />
              <button type="button" onClick={() => onOpenItem(item.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                <p className="truncate text-xs text-gray-500">{hqRecRationale(item)}</p>
              </button>
              <div className="hidden shrink-0 items-center gap-1.5 text-sm tabular-nums sm:flex">
                <span className="text-gray-400">{fmt(current)}</span>
                <span aria-hidden="true" className="text-gray-300">→</span>
                <span className={`rounded px-1.5 py-0.5 font-semibold text-gray-900 ${meta.pill}`}>{fmt(proposed)}</span>
                {pct !== 0 && <span className="text-xs text-gray-500">{pct < 0 ? "↓" : "↑"}{Math.abs(pct)}%</span>}
              </div>
              {flagged && (
                <span className="hidden items-center gap-1 text-xs font-medium text-amber-700 md:flex" title="Worth a closer look">
                  <AlertTriangle className="size-3.5" aria-hidden="true" /> look
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {/* Tooltips name each icon-only action; the hover scale (Accept) /
                    red tint (Skip = reject) keeps the interaction tactile. */}
                <Tooltip content="Accept HQ rec">
                  <span className="inline-flex">
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Check}
                      aria-label={`Accept ${item.name}`}
                      onClick={() => acceptOne(item)}
                      className="transition-transform duration-150 hover:scale-110 motion-reduce:transition-none"
                    />
                  </span>
                </Tooltip>
                <Tooltip content="Skip — keep current price">
                  <span className="inline-flex">
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconLeft={X}
                      aria-label={`Skip ${item.name}`}
                      onClick={() => skipOne(item)}
                      className="transition-all duration-150 hover:scale-110 hover:!bg-red-50 hover:!text-red-600 motion-reduce:transition-none"
                    />
                  </span>
                </Tooltip>
                <Tooltip content="Open details">
                  <span className="inline-flex">
                    <Button variant="tertiary" size="sm" iconLeft={ChevronRight} aria-label={`Open ${item.name}`} onClick={() => onOpenItem(item.id)} />
                  </span>
                </Tooltip>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
