"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Button,
  Badge,
  CountBadge,
  Modal,
  ToggleGroup,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { DateField, todayIso } from "@/components/shared/DateField";
import { TimeField, DEFAULT_SEND_TIME } from "@/components/shared/TimeField";
import { SearchX, ArrowLeft, ListFilter, CheckCircle2, CalendarClock, Plus, Package, Loader2, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorePricingHeader } from "@/components/store/StorePricingHeader";
import { ItemsToolbar } from "@/components/store/ItemsToolbar";
import { BatchDetailDrawer } from "@/components/batches/BatchDetailDrawer";
import { MobileItemList } from "@/components/store/MobileItemList";
import { ScanOverlay } from "@/components/store/ScanOverlay";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildStoreColumns, STORE_OPTIONAL_COLUMNS, shelfTagKind, SHELF_TAG_META } from "@/components/store/buildStoreColumns";
import { ItemEditDrawer } from "@/components/pricing-table/ItemEditDrawer";
import { FilterDrawer, FilterFacet, FilterValue } from "@/components/filters/FilterDrawer";
import { FilterChips } from "@/components/filters/FilterChips";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { NewBatchModal } from "@/components/pending/NewBatchModal";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { buildFanoutSources, planFanout } from "@/lib/store-fanout";
import { TOTAL_ITEM_COUNT } from "@/lib/mock-data";
import { PricingItem, Batch, HqChangeReason } from "@/types/pricing";
import { pricingStrategyFullLabel, itemChangeGroups, CHANGE_FILTER_OPTIONS } from "@/lib/change-summary";
import { hqReviewNeeded } from "@/lib/item-status";
import { HQ_REASONS, REASON_META } from "@/lib/price-change-reason";
import { itemIdsWithSoftViolations } from "@/lib/relationship-validation";
import { fmtDateTime } from "@/lib/format";

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

// Empty-state copy for the zero-rows case, accurate to what's actually
// narrowing the list — a director clearing "your filters" shouldn't be told
// to "try a different search" when they never typed one (and vice versa).
function emptyStateCopy(hasSearch: boolean, hasFilters: boolean, reviewActive: boolean) {
  const scope = reviewActive ? "your review queue" : "more items";
  if (hasFilters && hasSearch) {
    return { title: "No items match your search and filters", hint: `Clear filters or try a different search to see ${scope}.` };
  }
  if (hasFilters) {
    return { title: "No items match your filters", hint: `Clear filters to see ${scope}.` };
  }
  if (hasSearch) {
    return { title: "No items match your search", hint: "Try a different search term." };
  }
  return { title: "No items match", hint: "Try a different search or clear the filters." };
}

export default function StorePricingPage() {
  const toast = useToast();
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const createBatch = usePricingStore((s) => s.createBatch);
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const scheduleBatch = usePricingStore((s) => s.scheduleBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const confirmBatch = usePricingStore((s) => s.confirmBatch);

  // "To send" is a LENS over All items (not a separate destination): it focuses on
  // the batches waiting to go to SAP.
  const [hangLensOn, setHangLensOn] = useState(false);
  // HQ review is an in-place filter over All items, not a separate screen: the
  // "HQ sent N" banner narrows the table to items still awaiting the director's
  // call. Decisions happen in the row drawer, just like any other edit.
  const [reviewOnly, setReviewOnly] = useState(false);
  // To-send lifecycle: Scheduled (upcoming) vs Sent. Every batch is scheduled at
  // creation, so there's no draft/pending bucket.
  const [toSendSegment, setToSendSegment] = useState<"scheduled" | "sent">("scheduled");
  // Inline re-scheduling: pick a date + time for an existing batch.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string | null>(null);
  const [scheduleBatchId, setScheduleBatchId] = useState<string | null>(null);
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [newBatch, setNewBatch] = useState<{ open: boolean; seedIds: string[] }>({ open: false, seedIds: [] });
  // The batch a change just landed in — drives a brief highlight on its row in the
  // To-send list so the user sees exactly where it went. The counter re-triggers
  // the animation when the same batch is targeted twice in a row.
  const [batchFlash, setBatchFlash] = useState<{ id: string; n: number } | null>(null);
  // Mirrors batchFlash for the Sent & Live list — fires when a batch transitions
  // submitted → confirmed so the go-live moment gets a visible acknowledgment.
  const [confirmedFlash, setConfirmedFlash] = useState<{ id: string; n: number } | null>(null);
  const [confirmSendBatchId, setConfirmSendBatchId] = useState<string | null>(null);
  const prevBatchStatuses = useRef(new Map<string, string>(batches.map((b) => [b.id, b.status])));
  // Simulated SAP acknowledgment: a batch sent during this session confirms back
  // after a short delay so Sending resolves to Live (only scheduled → submitted
  // transitions observed here arm a timer; nothing confirms on load).
  const confirmTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const hqCount = useMemo(() => items.filter(hqReviewNeeded).length, [items]);

  // Pending HQ recommendations broken down by change reason. Deliberately quiet:
  // it renders as a plain-text summary in the review banner (secondary info),
  // with per-reason filtering tucked into the Filters drawer as a facet.
  const hqReasonSummary = useMemo(() => {
    const counts: Partial<Record<HqChangeReason, number>> = {};
    for (const i of items) {
      if (!hqReviewNeeded(i) || !i.hqChangeReason) continue;
      counts[i.hqChangeReason] = (counts[i.hqChangeReason] ?? 0) + 1;
    }
    return HQ_REASONS.filter((r) => (counts[r] ?? 0) > 0)
      .map((r) => `${counts[r]} ${REASON_META[r].summary}`)
      .join(" · ");
  }, [items]);

  const batchCount = useMemo(
    () => batches.filter((b) => b.status === "scheduled").length,
    [batches]
  );
  // Pulse the badge when the batch count grows (e.g. after a new batch) so the
  // user sees their action land. Re-keys the badge to restart the anim.
  const [trayPulse, setTrayPulse] = useState(0);
  const prevTrayCount = useRef(batchCount);
  useEffect(() => {
    if (batchCount > prevTrayCount.current) {
      setTrayPulse((n) => n + 1);
      // Fire a one-time onboarding toast the very first time a batch is created.
      if (prevTrayCount.current === 0) {
        toast.success('Batch created — it sends automatically at the scheduled time, or open it and use "Send now".');
      }
    }
    prevTrayCount.current = batchCount;
  }, [batchCount, toast]);

  // Toast once when the last HQ recommendation is reviewed (hqCount drops to 0
  // while the director is in the review flow). The ref is initialised to hqCount
  // so we never fire on the very first render when hqCount may already be 0.
  const prevHqCount = useRef(hqCount);
  useEffect(() => {
    if (prevHqCount.current > 0 && hqCount === 0 && reviewOnly) {
      toast.success("All HQ recommendations reviewed — add your changes to a batch to send to SAP.");
    }
    prevHqCount.current = hqCount;
  }, [hqCount, reviewOnly, toast]);

  useEffect(() => {
    batches.forEach((b) => {
      if (
        prevBatchStatuses.current.get(b.id) === "scheduled" &&
        b.status === "submitted" &&
        !confirmTimers.current.has(b.id)
      ) {
        confirmTimers.current.set(
          b.id,
          setTimeout(() => {
            confirmTimers.current.delete(b.id);
            confirmBatch(b.id);
          }, 10_000)
        );
      }
      if (prevBatchStatuses.current.get(b.id) === "submitted" && b.status === "confirmed") {
        const count = overrides.filter((o) => o.batchId === b.id).length;
        toast.success(`"${b.name}" is now live in SAP — ${count} item${count !== 1 ? "s" : ""}`);
        setConfirmedFlash((f) => ({ id: b.id, n: (f?.n ?? 0) + 1 }));
      }
    });
    prevBatchStatuses.current = new Map(batches.map((b) => [b.id, b.status]));
  }, [batches, overrides, toast, confirmBatch]);

  useEffect(() => {
    const timers = confirmTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const openBatches = useMemo(
    () => batches.filter((b) => b.status === "scheduled"),
    [batches]
  );
  const scheduledBatches = useMemo(() => batches.filter((b) => b.status === "scheduled"), [batches]);
  const sentBatches = useMemo(
    () => batches.filter((b) => b.status === "submitted" || b.status === "confirmed"),
    [batches]
  );
  // Distinct items across a set of batches — so the To-send tabs all count the
  // same unit (items), not a mix of items and batch records.
  const itemsInBatches = (bs: typeof batches) =>
    bs.reduce((n, b) => n + new Set(b.overrideIds.map((id) => id.split(":")[0])).size, 0);

  // The distinct items inside a batch — used to show a glanceable tag-swatch
  // preview + count so a batch isn't an opaque "N items".
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const batchItems = (b: Batch): PricingItem[] =>
    [...new Set(b.overrideIds.map((id) => id.split(":")[0]))]
      .map((id) => itemsById.get(id))
      .filter((i): i is PricingItem => i != null);

  // Items with an unresolved narrow-gap pricing-relationship warning — powers
  // the "Pricing conflicts" facet so a director can spot these before batching
  // without opening every item's drawer.
  const conflictIds = useMemo(
    () => itemIdsWithSoftViolations(items, itemsById),
    [items, itemsById]
  );

  // ── Faceted filtering (All items / HQ tabs) ──────────────────────────────
  const facets: FilterFacet[] = useMemo(
    () => [
      // Change type is first so FilterDrawer opens it by default (DT-05).
      // Change type matches any of a (possibly multi-change) item's actions (AC7).
      { key: "changeType", label: "Change type", options: CHANGE_FILTER_OPTIONS.filter((o) =>
        items.some((i) => itemChangeGroups(i).includes(o))
      ) },
      // HQ's change reason — deliberately a facet (not table furniture): filter
      // the review queue by reason without the reason crowding the rows.
      { key: "hqReason", label: "HQ reason", options: uniqueSorted(
        items.filter(hqReviewNeeded).map((i) => i.hqChangeReason && REASON_META[i.hqChangeReason].label).filter((l): l is string => l != null)
      ) },
      { key: "brand", label: "Brand", options: uniqueSorted(items.map((i) => i.brand)) },
      { key: "category", label: "Category", options: uniqueSorted(items.map((i) => i.category)) },
      { key: "itemRole", label: "Item role", options: uniqueSorted(items.map((i) => i.itemRole)) },
      { key: "nationalVsStore", label: "National vs. store", options: uniqueSorted(items.map((i) => i.nationalVsStore)) },
      { key: "sensitivity", label: "Sensitivity", options: uniqueSorted(items.map((i) => i.sensitivity)) },
      { key: "strategy", label: "Pricing strategy", options: uniqueSorted(items.map(pricingStrategyFullLabel)) },
      // Gated on data actually present, like Change type above — neither shows
      // as a dead option on a clean seed.
      ...(items.some((i) => i.hasAlert)
        ? [{ key: "hasAlert", label: "Alerts", options: ["Flagged"] }]
        : []),
      ...(conflictIds.size > 0
        ? [{ key: "conflicts", label: "Pricing conflicts", options: ["Has a guardrail warning"] }]
        : []),
    ],
    [items, conflictIds]
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
        if (key === "hqReason") {
          if (!i.hqChangeReason || !opts.includes(REASON_META[i.hqChangeReason].label)) return false;
          continue;
        }
        // Boolean facets: the generic string-equality branch below would
        // silently no-op on these (opts.includes() against a boolean, or
        // against a key that isn't a PricingItem property at all).
        if (key === "hasAlert") {
          if (!i.hasAlert) return false;
          continue;
        }
        if (key === "conflicts") {
          if (!conflictIds.has(i.id)) return false;
          continue;
        }
        const itemValue =
          key === "strategy" ? pricingStrategyFullLabel(i) : (i as unknown as Record<string, string>)[key];
        if (!opts.includes(itemValue)) return false;
      }
      return true;
    },
    [filters, conflictIds]
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

  // The review filter is only "live" while recommendations remain — once the last
  // one is decided it falls away on its own, so the director isn't left staring at
  // an empty table (no effect/setState needed; it's derived).
  const reviewActive = reviewOnly && hqCount > 0;

  const rows = useMemo(() => {
    let list = items;
    // "HQ sent N" banner: narrow to items still awaiting the director's review,
    // optionally scoped to one change reason via the triage chips.
    if (reviewActive) list = list.filter(hqReviewNeeded);
    list = list.filter(matchesFilters);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    // Recent-first: items with an active edit float to the top, newest first;
    // everything else keeps its order (V8 sort is stable).
    return [...list].sort((a, b) => (activeAtById.get(b.id) ?? 0) - (activeAtById.get(a.id) ?? 0));
  }, [items, reviewActive, matchesFilters, search, activeAtById]);

  // The table is read-only — every decision is made in the drawer and forced into
  // a batch, so there's no row selection / bulk bar.
  const columns = useMemo(() => buildStoreColumns(batches, visibleCols), [batches, visibleCols]);

  const columnOptions = STORE_OPTIONAL_COLUMNS.map((c) => ({ ...c, visible: visibleCols.has(c.id) }));
  const onToggleColumn = (id: string, visible: boolean) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      visible ? next.add(id) : next.delete(id);
      return next;
    });

  const openNewBatch = (seedIds: string[]) => setNewBatch({ open: true, seedIds });

  const addOverridesToBatch = (batchId: string, ids: string[]) => {
    if (ids.length === 0) return;
    addToBatch(batchId, ids);
    setBatchFlash((prev) => ({ id: batchId, n: (prev?.n ?? 0) + 1 }));
    const name = usePricingStore.getState().batches.find((b) => b.id === batchId)?.name ?? "batch";
    const items = new Set(ids.map((id) => id.split(":")[0])).size;
    toast.success(`Added ${items} item${items !== 1 ? "s" : ""} to ${name}`, {
      action: { label: "Undo", onClick: () => ids.forEach((id) => removeFromLooseTray(id)) },
    });
  };

  const confirmScheduleBatch = () => {
    if (!scheduleBatchId || !scheduleDate || !scheduleTime) return;
    const at = `${scheduleDate}T${scheduleTime}:00`;
    scheduleBatch(scheduleBatchId, at);
    setScheduleOpen(false);
    setScheduleBatchId(null);
    toast.success(`Scheduled for ${fmtDateTime(at)}`, { description: "It will send to SAP automatically at that time." });
  };

  const openScheduleBatch = (batchId: string, current?: string | null) => {
    setScheduleBatchId(batchId);
    const d = current ? new Date(current) : null;
    setScheduleDate(d ? current!.slice(0, 10) : todayIso());
    setScheduleTime(d ? current!.slice(11, 16) : DEFAULT_SEND_TIME);
    setScheduleOpen(true);
  };

  // The clickable identity of a batch: an icon with a numeric badge of its item
  // count + a row of tag-color swatches so a director can see WHAT's inside at a
  // glance (a wall of yellow = this week's promos) instead of an opaque "N items".
  const renderBatchIdentity = (b: Batch, subtext: ReactNode, bump = false) => {
    const bItems = batchItems(b);
    const count = bItems.length;
    return (
      <button
        type="button"
        onClick={() => setManageBatchId(b.id)}
        aria-label={`Open ${b.name} details`}
        className="group -m-1.5 flex min-w-0 items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-gray-50"
      >
        <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Package className="size-5 text-brand" aria-hidden="true" />
          {count > 0 && (
            // Pops when the count grows, mirroring the To-send button's badge.
            <span className={`absolute -top-1.5 -right-1.5 ${bump ? "badge-pop" : ""}`}>
              <CountBadge count={count} tone="neutral" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-900 group-hover:text-brand group-hover:underline">{b.name}</span>
            {(b.targetStoreIds?.length ?? 1) > 1 && (
              <Badge tone="in-progress" size="sm">{b.targetStoreIds!.length} stores</Badge>
            )}
          </span>
          {subtext && <p className="flex items-center gap-1.5 text-xs text-gray-500">{subtext}</p>}
          {count > 0 && (
            // Tag-shaped chips (wider than tall) so a lone white one doesn't read
            // as an empty checkbox — these are shelf tags, scanned for composition.
            <div className="mt-1 flex items-center gap-1" aria-label={`${count} item${count !== 1 ? "s" : ""} in this batch`}>
              {bItems.slice(0, 8).map((it) => (
                <span
                  key={it.id}
                  title={it.name}
                  aria-label={`${SHELF_TAG_META[shelfTagKind(it)].label} — ${it.name}`}
                  className={`h-2.5 w-4 rounded-[2px] border ${SHELF_TAG_META[shelfTagKind(it)].swatch}`}
                />
              ))}
              {count > 8 && <span className="text-xs text-gray-400">+{count - 8}</span>}
            </div>
          )}
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand"
        />
      </button>
    );
  };

  const renderOpenBatchRow = (b: Batch) => {
    const flashing = batchFlash?.id === b.id;
    return (
      <div
        // Re-key while flashing so the highlight animation restarts even when the
        // same batch is targeted twice. The row bounces (send-bump) + highlights
        // (batch-flash) when items land — the same satisfying motion as the
        // To-send button.
        key={flashing ? `${b.id}-flash-${batchFlash.n}` : b.id}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 ${flashing ? "batch-flash send-bump" : ""}`}
      >
        {renderBatchIdentity(
          b,
          <><CalendarClock className="size-3.5" aria-hidden="true" /> {b.scheduledAt ? fmtDateTime(b.scheduledAt) : "Scheduled"}</>,
          flashing
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone="neutral" size="sm">Scheduled</Badge>
          <Button variant="tertiary" size="sm" iconLeft={CalendarClock} onClick={() => openScheduleBatch(b.id, b.scheduledAt)}>
            Reschedule
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirmSendBatchId(b.id)}>Send now</Button>
        </div>
      </div>
    );
  };

  const renderSentBatchRow = (b: Batch) => {
    const live = b.status === "confirmed";
    const flashing = confirmedFlash?.id === b.id;
    return (
      <div
        key={flashing ? `${b.id}-confirmed-${confirmedFlash!.n}` : b.id}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 ${flashing ? "batch-flash" : ""}`}
      >
        {renderBatchIdentity(b, null)}
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
    <div id="main-content" className="flex h-full flex-col bg-gray-50">
      <AppHeader
        hqCount={hqCount}
        onViewHq={() => {
          if (hqCount > 0) {
            setHangLensOn(false);
            setReviewOnly(true);
          }
        }}
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 flex flex-col min-h-0 overflow-auto px-4 py-6 md:px-8">
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
                  // on the shelf. Primary when there are batches waiting, secondary otherwise.
                  variant={batchCount > 0 ? 'primary' : 'secondary'}
                  iconLeft={Package}
                  onClick={() => setHangLensOn((on) => !on)}
                >
                  Batches
                </Button>
              </span>
              {batchCount > 0 && (
                <span key={`badge-${trayPulse}`} className="badge-pop absolute -top-1.5 -right-1.5 pointer-events-none">
                  <CountBadge count={batchCount} tone="warning" />
                </span>
              )}
            </div>
            )}
        </div>

        <>
            {hangLensOn ? (
              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="tertiary" size="sm" iconLeft={ArrowLeft} onClick={() => setHangLensOn(false)}>
                    All items
                  </Button>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                    <Package className="size-5 text-brand" aria-hidden="true" /> Batches
                  </h2>
                </div>
                <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:px-0">
                  <ToggleGroup
                    aria-label="Batch lifecycle"
                    value={toSendSegment}
                    onValueChange={(v) => setToSendSegment(v as "scheduled" | "sent")}
                    options={[
                      { value: "scheduled", label: `Scheduled (${itemsInBatches(scheduledBatches)})` },
                      { value: "sent", label: `Sent & Live (${itemsInBatches(sentBatches)})` },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  All items{" "}
                  <span className="ml-1 text-sm font-normal text-gray-400">
                    {activeFilterCount > 0 || search
                      ? `${rows.length} of ${TOTAL_ITEM_COUNT.toLocaleString()}`
                      : TOTAL_ITEM_COUNT.toLocaleString()}
                  </span>
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

            <div className="mt-4 flex-1 md:min-h-0 flex flex-col">
              {!hangLensOn && activeFilterCount > 0 && (
                <FilterChips facets={facets} value={filters} onChange={setFilters} />
              )}
              {!hangLensOn && hqCount > 0 && !reviewActive && (
                <button
                  type="button"
                  onClick={() => setReviewOnly(true)}
                  className="mb-4 flex w-full flex-col items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-left transition-colors hover:bg-brand/10 md:flex-row md:items-center md:justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="relative flex size-2.5 shrink-0">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                    </span>
                    <span className="text-sm text-gray-800">
                      <span className="font-semibold">HQ sent {hqCount} recommendation{hqCount === 1 ? "" : "s"}</span> to review
                      {/* The reason breakdown replaces the old filler phrase — the
                          same muted register, but it says something. */}
                      {hqReasonSummary && <span className="hidden text-gray-500 md:inline"> — {hqReasonSummary}</span>}.
                    </span>
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand"
                    aria-label={`Review ${hqCount} HQ recommendation${hqCount !== 1 ? 's' : ''}`}
                  >
                    <ListFilter className="size-4" aria-hidden="true" /> Review recommendations
                  </span>
                </button>
              )}
              {!hangLensOn && reviewActive && (
                <div className="mb-4 flex w-full flex-col items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <span className="flex items-center gap-2.5">
                    <span className="relative flex size-2.5 shrink-0">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                    </span>
                    <span className="text-sm text-gray-800">
                      Showing <span className="font-semibold">{rows.length} item{rows.length === 1 ? "" : "s"} that need review</span>
                      {hqReasonSummary && <span className="hidden text-gray-500 md:inline"> — {hqReasonSummary}</span>}.
                    </span>
                  </span>
                  <Button variant="tertiary" size="sm" onClick={() => setReviewOnly(false)}>
                    Back to all items
                  </Button>
                </div>
              )}
              {hangLensOn && toSendSegment === "scheduled" && (
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Your batches</p>
                    <Button variant="tertiary" size="sm" iconLeft={Plus} onClick={() => openNewBatch([])}>
                      New batch
                    </Button>
                  </div>
                  {scheduledBatches.length === 0 ? (
                    <EmptyState
                      icon={CalendarClock}
                      title="No scheduled batches"
                      hint="Create a batch — with a send date and time — to start moving changes to SAP."
                      className="py-16"
                    />
                  ) : (
                    <div className="flex flex-col gap-2">{scheduledBatches.map(renderOpenBatchRow)}</div>
                  )}
                </div>
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
              {!hangLensOn && (rows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  {...emptyStateCopy(!!search, activeFilterCount > 0, reviewActive)}
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
                        {activeFilterCount > 0 && !search ? "Clear filters" : "Clear search & filters"}
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  <div className="md:hidden">
                    <MobileItemList
                      rows={rows}
                      batches={batches}
                      onRowClick={(r) => setDrawerItemId(r.id)}
                    />
                  </div>

                  {/* Tablet/desktop: full data table. flex-1 + min-h-0 lets DataTable's
                      h-full/overflow-auto create a real scroll container so sticky headers work. */}
                  <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
                    <DataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(r) => r.id}
                      flat
                      isOverride={(r) => r.hasOverride}
                      needsReview={(r) => hqReviewNeeded(r)}
                      onRowClick={(r) => setDrawerItemId(r.id)}
                    />
                  </div>
                </>
              ))}
            </div>
        </>
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
        onAddToBatch={addOverridesToBatch}
        onNewBatch={openNewBatch}
        onClose={() => setDrawerItemId(null)}
      />

      <NewBatchModal
        open={newBatch.open}
        onOpenChange={(open) => setNewBatch((p) => ({ ...p, open }))}
        candidates={pending}
        initialSelectedIds={newBatch.seedIds}
        onCreate={(name, ids, scheduledAt, targetStoreIds) => {
          // Summarize the fan-out from pre-apply state so the toast can report
          // what landed where (applied / overwritten / skipped) across stores.
          const st = usePricingStore.getState();
          const selected = st.overrides.filter((o) => ids.includes(o.id));
          const targets = [...new Set([st.activeStoreId, ...targetStoreIds])];
          const multiStore = targets.length > 1;
          const summary = multiStore
            ? planFanout(
                buildFanoutSources(selected, st.items),
                targets,
                st.activeStoreId,
                { items: st.items, overrides: st.overrides, batches: [] },
                st.stash
              )
            : null;

          createBatch(name, ids, scheduledAt, targetStoreIds);
          // The active-store batch is appended last; flash it so the user sees where it landed.
          const all = usePricingStore.getState().batches;
          const newId = all[all.length - 1]?.id ?? null;
          if (newId) setBatchFlash((prev) => ({ id: newId, n: (prev?.n ?? 0) + 1 }));

          if (multiStore && summary) {
            const applied = summary.totalApplied + summary.totalConflicts;
            const skipped = summary.totalMissing + summary.totalLocked;
            const parts = [`${applied} change${applied !== 1 ? "s" : ""} across ${targets.length} stores`];
            if (summary.totalConflicts > 0) parts.push(`${summary.totalConflicts} overwritten`);
            if (skipped > 0) parts.push(`${skipped} skipped`);
            toast.success(`Batch "${name}" scheduled for ${targets.length} stores`, {
              description: parts.join(" · "),
            });
          } else {
            toast.success(`Batch "${name}" scheduled for ${fmtDateTime(scheduledAt)}`, {
              description: `${ids.length} price change${ids.length !== 1 ? "s" : ""} grouped`,
            });
          }
        }}
      />

      <Modal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title="Schedule this batch"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!scheduleDate || !scheduleTime} onClick={confirmScheduleBatch}>Schedule</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            This batch will send to SAP automatically at the date and time you pick — it shows as
            <span className="font-medium text-gray-800"> Scheduled</span> until then.
          </p>
          <div className="flex items-center gap-2">
            <DateField value={scheduleDate} onChange={setScheduleDate} min={todayIso()} aria-label="Send date" />
            <TimeField value={scheduleTime} onChange={setScheduleTime} aria-label="Send time" />
          </div>
        </div>
      </Modal>

      <BatchDetailDrawer batchId={manageBatchId} onOpenChange={(o) => { if (!o) setManageBatchId(null); }} />

      {(() => {
        const sendBatch = batches.find((b) => b.id === confirmSendBatchId);
        const sendCount = sendBatch ? batchItems(sendBatch).length : 0;
        const storeCount = sendBatch?.targetStoreIds?.length ?? 1;
        const scopeSuffix = storeCount > 1 ? ` across ${storeCount} stores` : "";
        return (
          <ConfirmDialog
            open={confirmSendBatchId != null}
            onOpenChange={(open) => { if (!open) setConfirmSendBatchId(null); }}
            headline={storeCount > 1 ? `Send "${sendBatch?.name}" to ${storeCount} stores now?` : `Send "${sendBatch?.name}" to SAP now?`}
            description={`This sends changes to ${sendCount} item${sendCount !== 1 ? "s" : ""}${scopeSuffix} to SAP immediately — bypassing the scheduled date. Updated prices will be visible in stores within 1 hour, or on the next business day.`}
            confirmLabel={storeCount > 1 ? "Send to all stores now" : "Send to SAP now"}
            onConfirm={() => {
              if (!confirmSendBatchId) return;
              submitBatch(confirmSendBatchId);
            }}
          />
        );
      })()}
    </div>
  );
}
