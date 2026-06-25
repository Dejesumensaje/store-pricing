"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Select, Tooltip, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Check, X, ChevronRight, CheckCircle2, AlertTriangle, ArrowRight, Package } from "lucide-react";
import { BatchPickerModal } from "./BatchPickerModal";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { usePricingStore } from "@/store/pricing-store";
import { hqReviewNeeded } from "@/lib/item-status";
import { hqRecRationale } from "@/lib/hq-rec";
import { shelfTagKind, SHELF_TAG_META } from "./buildStoreColumns";
import { PricingItem, Batch } from "@/types/pricing";
import { fmt } from "@/lib/format";

// HQ can send a lot — so review is a scannable WORKLIST, not a 1-by-1 march:
// see everything at once (context + patterns), accept/keep inline, accept in
// bulk, and dive into the full card only for the ones that need a closer look.
// Accepting a rec ALWAYS drops it into a batch (existing or new) — there is no
// loose "to send" state; review decides the price + which batch it ships in.
type Props = {
  onExit: () => void;
  /** Open an item's full proposal card (the drawer) for a closer look. */
  onOpenItem: (id: string) => void;
  /** Jump to the Batches surface to schedule/send. */
  onGoToSend: () => void;
  openBatches: Batch[];
  /** Accept + assign override ids to a batch (owned by the page; toasts w/ Undo). */
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

export function ReviewFlow({ onExit, onOpenItem, onGoToSend, openBatches, onAddToBatch, onNewBatch }: Props) {
  const items = usePricingStore((s) => s.items);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const setReviewed = usePricingStore((s) => s.setReviewed);
  const toast = useToast();

  const [totalAtEntry] = useState(() => items.filter(hqReviewNeeded).length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("attention");
  // Confirm a bulk-accept that includes flagged proposals (big swings / alerts).
  const [confirmAcceptAll, setConfirmAcceptAll] = useState(false);
  // Items queued for the batch picker — accept + drop into the chosen/new batch.
  const [pendingCommit, setPendingCommit] = useState<PricingItem[] | null>(null);
  // How many changes were accepted into a batch this session (drives the handoff).
  const [sentToBatch, setSentToBatch] = useState(0);

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

  const acceptOne = (item: PricingItem) => {
    if (item.category_type === "temporary_allowance") {
      updateRetailPrice(item.id, 1, item.recommendedRetailPrice ?? item.currentBasePrice);
    } else {
      updateBasePrice(item.id, item.recommendedBasePrice);
    }
  };
  // Accept a set AND drop it into an existing batch (the page toasts with Undo).
  const acceptInto = (list: PricingItem[], batchId: string) => {
    if (list.length === 0) return;
    list.forEach(acceptOne);
    onAddToBatch(batchId, list.map(overrideIdFor));
    setSentToBatch((n) => n + list.length);
    setSelected(new Set());
  };
  // Single-row accept — every change must land in a batch the director chooses
  // (or creates). There is no implicit "active" batch; always open the picker.
  const acceptRow = (item: PricingItem) => setPendingCommit([item]);
  // "Keep" rejects the rec and keeps the current price — permanent, so Undoable.
  const skipOne = (item: PricingItem) => {
    acceptNoChange(item.id);
    toast.success("Kept current price", {
      action: { label: "Undo", onClick: () => setReviewed(item.id, false) },
    });
  };
  // Accept-all / accept-selected always go through the picker — a deliberate batch
  // choice for a big set. Accept-all confirms first if flagged proposals exist.
  const flaggedInQueue = useMemo(() => queue.filter((i) => proposal(i).flagged).length, [queue]);
  const acceptAll = () => {
    if (flaggedInQueue > 0) setConfirmAcceptAll(true);
    else setPendingCommit(queue);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── End of the queue: hand off to Batches (schedule/send) ───────────────────
  if (queue.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" aria-hidden="true" />
        <h2 className="text-xl font-bold text-gray-900">
          {totalAtEntry === 0 ? "No recommendations to review" : "All reviewed"}
        </h2>
        <p className="max-w-[320px] text-sm text-gray-500">
          {sentToBatch > 0
            ? `${sentToBatch} ${sentToBatch === 1 ? "change is" : "changes are"} in your batches. Schedule or send them when you're ready.`
            : "Nothing was accepted — nothing to send."}
        </p>
        {sentToBatch > 0 && (
          <Button variant="primary" iconRight={ArrowRight} onClick={onGoToSend} className="mt-1">
            Go to Batches
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
          {sentToBatch > 0 && (
            <button type="button" onClick={onGoToSend} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              <Check className="size-4" aria-hidden="true" /> {sentToBatch} in Batches
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
          <div className="w-48">
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
            <Button variant="secondary" size="sm" iconLeft={Package} onClick={() => setPendingCommit(queue.filter((i) => selected.has(i.id)))}>
              Accept &amp; batch ({selected.size})
            </Button>
          )}
          <Button variant="primary" size="sm" iconLeft={Check} onClick={acceptAll}>
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
                <Tooltip content="Accept & add to a batch">
                  <span className="inline-flex">
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Check}
                      aria-label={`Accept ${item.name}`}
                      onClick={() => acceptRow(item)}
                      className="transition-transform duration-150 hover:scale-110 motion-reduce:transition-none"
                    />
                  </span>
                </Tooltip>
                <Tooltip content="Keep the current price — reject HQ's proposal">
                  <span className="inline-flex">
                    {/* Labeled (not a bare ✕, which read as "delete/dismiss") and
                        neutral — keeping the current price is a valid choice, not
                        a destructive one. */}
                    <Button
                      variant="tertiary"
                      size="sm"
                      aria-label={`Keep current price for ${item.name}`}
                      onClick={() => skipOne(item)}
                      className="transition-transform duration-150 hover:scale-105 motion-reduce:transition-none"
                    >
                      Keep
                    </Button>
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

      <ConfirmDialog
        open={confirmAcceptAll}
        onOpenChange={(o) => { if (!o) setConfirmAcceptAll(false); }}
        headline={`Accept all ${queue.length} recommendations?`}
        description={`${flaggedInQueue} ${flaggedInQueue === 1 ? "is" : "are"} flagged for a closer look (a big swing or an alert). You'll pick the batch they ship in next.`}
        confirmLabel={`Accept all ${queue.length}`}
        onConfirm={() => setPendingCommit(queue)}
      />

      {/* Accepting forces a batch — pick an existing one or create a new (scheduled)
          one. There is no loose "to send" state. */}
      <BatchPickerModal
        open={pendingCommit != null}
        onOpenChange={(o) => { if (!o) setPendingCommit(null); }}
        title={`Accept ${pendingCommit?.length ?? 0} & add to a batch`}
        description="The accepted recommendations drop straight into the batch you pick — ready to schedule or send."
        openBatches={openBatches}
        count={pendingCommit?.length ?? 0}
        onAddToBatch={(id) => { if (pendingCommit) acceptInto(pendingCommit, id); setPendingCommit(null); }}
        onNewBatch={() => {
          if (pendingCommit) {
            pendingCommit.forEach(acceptOne);
            setSentToBatch((n) => n + pendingCommit.length);
            onNewBatch(pendingCommit.map(overrideIdFor));
            setSelected(new Set());
          }
          setPendingCommit(null);
        }}
      />
    </div>
  );
}
