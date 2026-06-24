"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Button,
  Badge,
  Checkbox,
  CountBadge,
  ActionBar,
  ActionBarLeading,
  ActionBarActions,
  Modal,
  ToggleGroup,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { DateField, todayIso } from "@/components/shared/DateField";
import { SearchX, ArrowLeft, Tags, ArrowRight, CheckCircle2, CalendarClock, Plus, Package, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorePricingHeader } from "@/components/store/StorePricingHeader";
import { ReviewFlow } from "@/components/store/ReviewFlow";
import { ItemsToolbar } from "@/components/store/ItemsToolbar";
import { BatchTrayView } from "@/components/store/BatchTrayView";
import { BatchSplitButton } from "@/components/store/BatchSplitButton";
import { BatchDetailDrawer } from "@/components/batches/BatchDetailDrawer";
import { MobileItemList } from "@/components/store/MobileItemList";
import { ScanOverlay } from "@/components/store/ScanOverlay";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildStoreColumns, STORE_OPTIONAL_COLUMNS } from "@/components/store/buildStoreColumns";
import { ItemEditDrawer } from "@/components/pricing-table/ItemEditDrawer";
import { FilterDrawer, FilterFacet, FilterValue } from "@/components/filters/FilterDrawer";
import { NewBatchModal } from "@/components/pending/NewBatchModal";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { TOTAL_ITEM_COUNT } from "@/lib/mock-data";
import { PricingItem, Batch } from "@/types/pricing";
import { pricingStrategyLabel, itemChangeGroups, CHANGE_FILTER_OPTIONS } from "@/lib/change-summary";
import { hqReviewNeeded } from "@/lib/item-status";

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

export default function StorePricingPage() {
  const toast = useToast();
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const createBatch = usePricingStore((s) => s.createBatch);
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const removeFromBatch = usePricingStore((s) => s.removeFromBatch);
  const scheduleBatch = usePricingStore((s) => s.scheduleBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);

  // All items is the director's permanent, recommendation-free workspace — find
  // any item, see its live state, edit prices on your own terms. HQ proposals are
  // a separate guided flow (reviewMode); they don't live here as a tab.
  const [view, setView] = useState<"items" | "batch">("items");
  // "Tags to hang" is a LENS over All items (not a separate destination): it
  // filters to the decided/ready tags and surfaces a Hang-all bar.
  const [hangLensOn, setHangLensOn] = useState(false);
  // The guided HQ review is a focused flow, not a passive tab — it swaps the
  // main content. All items stays the home for self-directed price management.
  const [reviewMode, setReviewMode] = useState(false);
  // The To-send surface mirrors the old batch tray's lifecycle tabs: Pending
  // (drafts + unbatched changes), Scheduled, and Sent.
  const [toSendSegment, setToSendSegment] = useState<"pending" | "scheduled" | "sent">("pending");
  // Inline scheduling: pick a date for the selected changes (a "batch" is just a
  // scheduled group — no separate workshop).
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleBatchId, setScheduleBatchId] = useState<string | null>(null);
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [newBatch, setNewBatch] = useState<{ open: boolean; seedIds: string[] }>({ open: false, seedIds: [] });
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  // The batch a selection just landed in — drives a brief highlight on its row in
  // the To-send list so the user sees exactly where their items went. The counter
  // re-triggers the animation when the same batch is targeted twice in a row.
  const [batchFlash, setBatchFlash] = useState<{ id: string; n: number } | null>(null);

  const trayCount = overrides.filter((o) => o.status === "pending" || o.status === "in_batch").length;
  const hqCount = useMemo(() => items.filter(hqReviewNeeded).length, [items]);

  // Pulse the tray badge when its count grows (e.g. after add-to-batch) so the
  // user sees where their action landed. Re-keys the badge to restart the anim.
  const [trayPulse, setTrayPulse] = useState(0);
  const prevTrayCount = useRef(trayCount);
  useEffect(() => {
    if (trayCount > prevTrayCount.current) setTrayPulse((n) => n + 1);
    prevTrayCount.current = trayCount;
  }, [trayCount]);

  // Batches the user can still build into (one-click "active batch" target).
  const openBatches = useMemo(
    () => batches.filter((b) => b.status === "draft" || b.status === "scheduled"),
    [batches]
  );
  // Lifecycle groupings for the To-send tabs.
  const draftBatches = useMemo(() => batches.filter((b) => b.status === "draft"), [batches]);
  const scheduledBatches = useMemo(() => batches.filter((b) => b.status === "scheduled"), [batches]);
  const sentBatches = useMemo(
    () => batches.filter((b) => b.status === "submitted" || b.status === "confirmed"),
    [batches]
  );
  const activeBatch = openBatches.find((b) => b.id === activeBatchId) ?? null;

  // Keep an active batch selected: fall back to the most recent open batch when
  // the current one is gone (sent) or none is set.
  useEffect(() => {
    if (activeBatchId && openBatches.some((b) => b.id === activeBatchId)) return;
    setActiveBatchId(openBatches.length ? openBatches[openBatches.length - 1].id : null);
  }, [openBatches, activeBatchId]);

  // ── Faceted filtering (All items / HQ tabs) ──────────────────────────────
  const facets: FilterFacet[] = useMemo(
    () => [
      { key: "brand", label: "Brand", options: uniqueSorted(items.map((i) => i.brand)) },
      { key: "category", label: "Category", options: uniqueSorted(items.map((i) => i.category)) },
      { key: "itemRole", label: "Item role", options: uniqueSorted(items.map((i) => i.itemRole)) },
      { key: "nationalVsStore", label: "National vs. store", options: uniqueSorted(items.map((i) => i.nationalVsStore)) },
      { key: "sensitivity", label: "Sensitivity", options: uniqueSorted(items.map((i) => i.sensitivity)) },
      { key: "strategy", label: "Pricing strategy", options: uniqueSorted(items.map(pricingStrategyLabel)) },
      // Change type matches any of a (possibly multi-change) item's actions (AC7).
      { key: "changeType", label: "Change type", options: CHANGE_FILTER_OPTIONS.filter((o) =>
        items.some((i) => itemChangeGroups(i).includes(o))
      ) },
    ],
    [items]
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((n, opts) => n + opts.length, 0),
    [filters]
  );

  const matchesFilters = useCallback(
    (i: PricingItem) => {
      for (const [key, opts] of Object.entries(filters)) {
        if (opts.length === 0) continue;
        // Change type is multi-valued: an item matches if any of its actions'
        // groups is selected (so a multi-change item shows under each one).
        if (key === "changeType") {
          if (!itemChangeGroups(i).some((g) => opts.includes(g))) return false;
          continue;
        }
        const itemValue =
          key === "strategy" ? pricingStrategyLabel(i) : (i as unknown as Record<string, string>)[key];
        if (!opts.includes(itemValue)) return false;
      }
      return true;
    },
    [filters]
  );

  // Items with a pending decision — the "ready to hang" tags. The Hang-all action
  // and the lens both key off this; selection is limited to these too.
  const pendingItemIds = useMemo(
    () => new Set(overrides.filter((o) => o.status === "pending").map((o) => o.itemId)),
    [overrides]
  );
  // When each item was last edited — so recently-decided items rise to the top of
  // All items (the director sees what they just touched without hunting).
  const activeAtById = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) {
      if (o.status === "pending" || o.status === "in_batch") {
        m.set(o.itemId, Math.max(m.get(o.itemId) ?? 0, o.updatedAt ?? 0));
      }
    }
    return m;
  }, [overrides]);

  const rows = useMemo(() => {
    let list = items;
    list = list.filter(matchesFilters);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    // The Tags-to-hang lens narrows All items to the ready tags.
    if (hangLensOn) list = list.filter((i) => pendingItemIds.has(i.id));
    // Recent-first: items with an active edit float to the top, newest first;
    // everything else keeps its order (V8 sort is stable).
    return [...list].sort((a, b) => (activeAtById.get(b.id) ?? 0) - (activeAtById.get(a.id) ?? 0));
  }, [items, matchesFilters, search, hangLensOn, pendingItemIds, activeAtById]);

  // ── Selection ────────────────────────────────────────────────────────────
  // Only items with a pending decision can be selected (those are what hanging
  // sends) — guides the director to pick exactly what they've decided on.
  const isSelectable = useCallback((r: PricingItem) => pendingItemIds.has(r.id), [pendingItemIds]);
  const selectableRows = useMemo(() => rows.filter(isSelectable), [rows, isSelectable]);

  const toggle = useCallback(
    (row: PricingItem) => {
      if (!pendingItemIds.has(row.id)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(row.id) ? next.delete(row.id) : next.add(row.id);
        return next;
      });
    },
    [pendingItemIds]
  );
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allSel = selectableRows.length > 0 && selectableRows.every((r) => prev.has(r.id));
      return allSel ? new Set() : new Set(selectableRows.map((i) => i.id));
    });
  }, [selectableRows]);

  const columns = useMemo(
    () =>
      buildStoreColumns(
        {
          isSelected: (r) => selected.has(r.id),
          isSelectable,
          toggle,
          toggleAll,
          allSelected: selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id)),
        },
        batches,
        visibleCols
      ),
    [selected, selectableRows, isSelectable, toggle, toggleAll, batches, visibleCols]
  );

  const columnOptions = STORE_OPTIONAL_COLUMNS.map((c) => ({ ...c, visible: visibleCols.has(c.id) }));
  const onToggleColumn = (id: string, visible: boolean) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      visible ? next.add(id) : next.delete(id);
      return next;
    });

  // Override ids for the selected items that are still pending (batchable).
  const selectedPendingIds = useMemo(
    () => overrides.filter((o) => selected.has(o.itemId) && o.status === "pending").map((o) => o.id),
    [overrides, selected]
  );

  const openNewBatch = (seedIds: string[]) => setNewBatch({ open: true, seedIds });

  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Assign changes to a batch — the conscious sorting that doses the send to SAP.
  // Shared by the bulk bar (the selection) and the drawer (one item). Undoable.
  const addOverridesToBatch = (batchId: string, ids: string[]) => {
    if (ids.length === 0) return;
    addToBatch(batchId, ids);
    setActiveBatchId(batchId);
    setBatchFlash((prev) => ({ id: batchId, n: (prev?.n ?? 0) + 1 }));
    const name = usePricingStore.getState().batches.find((b) => b.id === batchId)?.name ?? "batch";
    const items = new Set(ids.map((id) => id.split(":")[0])).size;
    toast.success(`Added ${items} to ${name}`, {
      action: { label: "Undo", onClick: () => ids.forEach((id) => removeFromBatch(id)) },
    });
  };
  const addSelectedToBatch = (batchId: string) => {
    addOverridesToBatch(batchId, selectedPendingIds);
    setSelected(new Set());
  };

  // Schedule a specific batch for a date — it sends to SAP automatically then.
  const confirmScheduleBatch = () => {
    if (!scheduleBatchId || !scheduleDate) return;
    scheduleBatch(scheduleBatchId, scheduleDate);
    const label = shortDate(scheduleDate);
    setScheduleOpen(false);
    setScheduleBatchId(null);
    toast.success(`Scheduled for ${label}`, { description: "Sends to SAP automatically on that date." });
  };

  const openScheduleBatch = (batchId: string, current?: string | null) => {
    setScheduleBatchId(batchId);
    setScheduleDate(current ?? todayIso());
    setScheduleOpen(true);
  };

  // A draft/scheduled batch row — name + schedule state + count, plus per-batch
  // Schedule / Send now. Flashes briefly when a selection just landed in it.
  const renderOpenBatchRow = (b: Batch) => {
    const count = new Set(b.overrideIds.map((id) => id.split(":")[0])).size;
    const isScheduled = b.status === "scheduled";
    const flashing = batchFlash?.id === b.id;
    return (
      <div
        // Re-key while flashing so the highlight animation restarts even when the
        // same batch is targeted twice.
        key={flashing ? `${b.id}-flash-${batchFlash.n}` : b.id}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 ${flashing ? "batch-flash" : ""}`}
      >
        <button type="button" onClick={() => setManageBatchId(b.id)} className="flex min-w-0 items-center gap-3 text-left">
          <Package className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{b.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              {isScheduled ? (
                <><CalendarClock className="size-3.5" aria-hidden="true" /> {b.scheduledAt ? shortDate(b.scheduledAt) : "scheduled"}</>
              ) : (
                "Not scheduled"
              )}
              <span className="text-gray-300">·</span> {count} item{count !== 1 ? "s" : ""}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={isScheduled ? "neutral" : "warning"} size="sm">{isScheduled ? "Scheduled" : "Draft"}</Badge>
          <Button variant="tertiary" size="sm" iconLeft={CalendarClock} onClick={() => openScheduleBatch(b.id, b.scheduledAt)}>
            {isScheduled ? "Reschedule" : "Schedule"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => submitBatch(b.id)}>Send now</Button>
        </div>
      </div>
    );
  };

  // A sent batch row — read-only, shows SAP status (Sending → Live). Opens the
  // detail drawer for a preview.
  const renderSentBatchRow = (b: Batch) => {
    const count = new Set(b.overrideIds.map((id) => id.split(":")[0])).size;
    const live = b.status === "confirmed";
    return (
      <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <button type="button" onClick={() => setManageBatchId(b.id)} className="flex min-w-0 items-center gap-3 text-left">
          <Package className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{b.name}</p>
            <p className="text-xs text-gray-500">{count} item{count !== 1 ? "s" : ""}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={live ? "success" : "warning"} size="sm">
            <span className="inline-flex items-center gap-1">
              {!live && <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />}
              {live ? "Live" : "Sending"}
            </span>
          </Badge>
          <Button variant="tertiary" size="sm" onClick={() => setManageBatchId(b.id)}>Preview</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        hqCount={hqCount}
        onViewHq={() => {
          setView("items");
          if (hqCount > 0) setReviewMode(true);
        }}
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">
        {/* Store identity + the "To send" navigation CTA belong to the item list.
            Inside the submission workflow they're dropped — that screen has its
            own self-contained header ("SAP Submission" + the lifecycle tabs). */}
        {view === "items" && (
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <StorePricingHeader />
            {/* The To-send button is hidden on the To-send surface itself — the
                lens header (All items · To send · tabs) already owns that nav, so
                a second button here is redundant. */}
            {!hangLensOn && (
            <div className="relative order-2 ml-auto inline-flex md:order-3">
              {/* Re-keyed on each increment so the whole button bounces (the
                  badge alone was easy to miss). */}
              <span key={`bump-${trayPulse}`} className="send-bump inline-flex">
                <Button
                  // A lens over All items: focus on the printed tags waiting to go
                  // on the shelf. Always visible so edits never feel like they
                  // vanished; gains emphasis once tags are waiting. From the HQ
                  // review flow it jumps straight to the To-send surface.
                  variant={hangLensOn ? "primary" : pendingItemIds.size > 0 ? "secondary" : "tertiary"}
                  iconLeft={Tags}
                  onClick={() => {
                    if (reviewMode) {
                      setReviewMode(false);
                      setHangLensOn(true);
                    } else {
                      setHangLensOn((on) => !on);
                    }
                  }}
                >
                  To send
                </Button>
              </span>
              {pendingItemIds.size > 0 && (
                <span key={`badge-${trayPulse}`} className="badge-pop absolute -top-1.5 -right-1.5 pointer-events-none">
                  <CountBadge count={pendingItemIds.size} tone="warning" />
                </span>
              )}
            </div>
            )}
          </div>
        )}

        {view === "batch" ? (
          <>
            <Button
              variant="tertiary"
              iconLeft={ArrowLeft}
              onClick={() => setView("items")}
              className="self-start"
            >
              Back to items
            </Button>
            <div className="mt-3">
              {/* The submission workspace owns its header: the "SAP Submission"
                  title sits in a row with the lifecycle tabs (see BatchTrayView). */}
              <BatchTrayView onNewBatch={openNewBatch} activeBatchId={activeBatchId} onSetActiveBatch={setActiveBatchId} />
            </div>
          </>
        ) : reviewMode ? (
          <div className="mt-8">
            <ReviewFlow
              onExit={() => setReviewMode(false)}
              onOpenItem={setDrawerItemId}
              onGoToSend={() => { setReviewMode(false); setHangLensOn(true); }}
              openBatches={openBatches}
              activeBatch={activeBatch}
              onAddToBatch={addOverridesToBatch}
              onNewBatch={openNewBatch}
            />
          </div>
        ) : (
          <>
            {hangLensOn ? (
              // Lens header — this is still All items, focused on the ready tags.
              // Lifecycle tabs (Pending / Scheduled / Sent) pin to the right.
              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="tertiary" size="sm" iconLeft={ArrowLeft} onClick={() => setHangLensOn(false)}>
                    All items
                  </Button>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                    <Tags className="size-5 text-brand" aria-hidden="true" /> To send
                  </h2>
                </div>
                <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:px-0">
                  <ToggleGroup
                    aria-label="Batch lifecycle"
                    value={toSendSegment}
                    onValueChange={(v) => setToSendSegment(v as "pending" | "scheduled" | "sent")}
                    options={[
                      { value: "pending", label: `Pending (${pendingItemIds.size + draftBatches.length})` },
                      { value: "scheduled", label: `Scheduled (${scheduledBatches.length})` },
                      { value: "sent", label: `Sent (${sentBatches.length})` },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  All items <span className="ml-1 text-sm font-medium text-gray-400">{TOTAL_ITEM_COUNT.toLocaleString()}</span>
                </h2>
                <ItemsToolbar
                  search={search}
                  onSearch={setSearch}
                  onOpenFilter={() => setFilterOpen(true)}
                  onScan={() => setScanOpen(true)}
                  activeFilterCount={activeFilterCount}
                  columnOptions={columnOptions}
                  onToggleColumn={onToggleColumn}
                />
              </div>
            )}

            <div className="mt-4">
              {/* HQ proposals are a guided flow, entered from here — not a tab the
                  director has to babysit. All items below is theirs to manage freely. */}
              {!hangLensOn && hqCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewMode(true)}
                  className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-left transition-colors hover:bg-brand/10"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                    </span>
                    <span className="text-sm text-gray-800">
                      <span className="font-semibold">HQ sent {hqCount} recommendation{hqCount === 1 ? "" : "s"}</span> to review — proposed price changes awaiting your call.
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
                    Review <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </button>
              )}
              {/* Your batches — the control panel. Multiple concurrent batches,
                  each scheduled independently, so the send to SAP is dosed (and
                  doesn't overload printing/control). The lifecycle tabs split
                  them into Pending (drafts + loose changes) / Scheduled / Sent. */}
              {hangLensOn && toSendSegment === "pending" && (
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Your batches</p>
                    <Button variant="tertiary" size="sm" iconLeft={Plus} onClick={() => openNewBatch(selectedPendingIds)}>
                      New batch
                    </Button>
                  </div>
                  {draftBatches.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
                      No draft batches yet. Select changes below and add them to a batch to control when they send.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">{draftBatches.map(renderOpenBatchRow)}</div>
                  )}
                </div>
              )}
              {hangLensOn && toSendSegment === "scheduled" && (
                scheduledBatches.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No scheduled batches"
                    hint="Scheduled batches wait here until their send date — then go to SAP automatically."
                    className="py-16"
                  />
                ) : (
                  <div className="flex flex-col gap-2">{scheduledBatches.map(renderOpenBatchRow)}</div>
                )
              )}
              {hangLensOn && toSendSegment === "sent" && (
                sentBatches.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No batches sent yet"
                    hint="Sent batches show up here with their SAP status (Sending → Live)."
                    className="py-16"
                  />
                ) : (
                  <div className="flex flex-col gap-2">{sentBatches.map(renderSentBatchRow)}</div>
                )
              )}
              {/* Pending tab cleared of loose changes — the satisfying "done". */}
              {hangLensOn && toSendSegment === "pending" && pendingItemIds.size === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <CheckCircle2 className="size-12 text-emerald-500" aria-hidden="true" />
                  <p className="text-base font-semibold text-gray-900">
                    {draftBatches.length > 0 ? "Everything's in a batch" : "All caught up"}
                  </p>
                  <p className="max-w-[300px] text-sm text-gray-500">
                    {draftBatches.length > 0
                      ? "No loose changes left to sort. Schedule or send your batches above."
                      : "Nothing pending to send. Edits you make will show up here."}
                  </p>
                  {draftBatches.length === 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setHangLensOn(false)}>
                      Back to all items
                    </Button>
                  )}
                </div>
              )}
              {/* Heading for the loose-changes inbox — the changes that have been
                  decided but aren't sorted into a batch yet. */}
              {hangLensOn && toSendSegment === "pending" && pendingItemIds.size > 0 && (
                <div className="mb-2 flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-gray-700">Not in a batch yet</p>
                  <span className="text-xs text-gray-400">{pendingItemIds.size} change{pendingItemIds.size !== 1 ? "s" : ""} · select to add to a batch</span>
                </div>
              )}
              {(!hangLensOn || (toSendSegment === "pending" && pendingItemIds.size > 0)) && (rows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No items match"
                  hint="Try a different search or clear the filters."
                  className="py-20"
                  action={
                    (search || activeFilterCount > 0) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setFilters({});
                        }}
                      >
                        Clear search &amp; filters
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  {/* Phone: tappable cards + a select-all bar (cards have no header checkbox). */}
                  <div className="md:hidden">
                    <div className="mb-2 flex items-center gap-2 px-3">
                      <Checkbox
                        checked={selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id))}
                        disabled={selectableRows.length === 0}
                        onCheckedChange={toggleAll}
                        aria-label="Select all decided items"
                      />
                      <span className="text-sm text-gray-600">
                        {selected.size > 0 ? `${selected.size} selected` : "Select decided"}
                      </span>
                    </div>
                    <MobileItemList
                      rows={rows}
                      batches={batches}
                      isSelected={(r) => selected.has(r.id)}
                      isSelectable={isSelectable}
                      toggle={toggle}
                      onRowClick={(r) => setDrawerItemId(r.id)}
                    />
                  </div>

                  {/* Tablet/desktop: full data table. */}
                  <div className="hidden md:block">
                    <DataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(r) => r.id}
                      flat
                      isSelected={(r) => selected.has(r.id)}
                      isOverride={(r) => r.hasOverride}
                      onRowClick={(r) => setDrawerItemId(r.id)}
                    />
                  </div>
                </>
              ))}
            </div>
          </>
        )}
      </main>

      <ScanOverlay
        open={scanOpen}
        items={items}
        onClose={() => setScanOpen(false)}
        onScanResult={(id) => {
          setScanOpen(false);
          setDrawerItemId(id);
        }}
      />

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} facets={facets} value={filters} onApply={setFilters} />

      <ItemEditDrawer
        itemId={drawerItemId}
        flow="all"
        openBatches={openBatches}
        activeBatch={activeBatch}
        onAddToBatch={addOverridesToBatch}
        onNewBatch={openNewBatch}
        onClose={() => setDrawerItemId(null)}
      />

      <NewBatchModal
        open={newBatch.open}
        onOpenChange={(open) => setNewBatch((p) => ({ ...p, open }))}
        candidates={pending}
        initialSelectedIds={newBatch.seedIds}
        onCreate={(name, ids) => {
          createBatch(name, ids);
          // The new batch is appended last; make it the active one and flash it.
          const all = usePricingStore.getState().batches;
          const newId = all[all.length - 1]?.id ?? null;
          setActiveBatchId(newId);
          if (newId) setBatchFlash((prev) => ({ id: newId, n: (prev?.n ?? 0) + 1 }));
          toast.success(`Batch "${name}" created`, {
            description: `${ids.length} price change${ids.length !== 1 ? "s" : ""} grouped`,
          });
          setSelected(new Set());
        }}
      />

      {selected.size > 0 && view === "items" && (!hangLensOn || toSendSegment === "pending") && (
        <ActionBar
          aria-label="Bulk item actions"
          position="bottom-center"
          liveText={`${selected.size} selected`}
          onDismiss={() => setSelected(new Set())}
        >
          <ActionBarLeading>
            <span className="text-sm font-medium text-white">
              {selected.size} item{selected.size !== 1 ? "s" : ""} selected
            </span>
          </ActionBarLeading>
          <ActionBarActions>
            {/* Batches are the only send path (they dose the SAP load), so the bulk
                bar sorts into a batch — no irreversible "send straight to SAP now". */}
            <BatchSplitButton
              size="sm"
              activeBatch={activeBatch}
              openBatches={openBatches}
              onAddToActive={() => activeBatch && addSelectedToBatch(activeBatch.id)}
              onAddToBatch={(id) => { setActiveBatchId(id); addSelectedToBatch(id); }}
              onNewBatch={() => openNewBatch(selectedPendingIds)}
              disabled={selectedPendingIds.length === 0}
            />
          </ActionBarActions>
        </ActionBar>
      )}

      <Modal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title="Schedule this batch"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!scheduleDate} onClick={confirmScheduleBatch}>Schedule</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            This batch will send to SAP automatically on the date you pick — it shows as
            <span className="font-medium text-gray-800"> Scheduled</span> until then.
          </p>
          <DateField value={scheduleDate} onChange={setScheduleDate} min={todayIso()} aria-label="Send date" />
        </div>
      </Modal>

      <BatchDetailDrawer batchId={manageBatchId} onOpenChange={(o) => { if (!o) setManageBatchId(null); }} />
    </div>
  );
}
