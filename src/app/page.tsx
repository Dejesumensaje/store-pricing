"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Button,
  Checkbox,
  CountBadge,
  ActionBar,
  ActionBarLeading,
  ActionBarActions,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { SearchX, ArrowLeft, Layers } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorePricingHeader } from "@/components/store/StorePricingHeader";
import { MainTabs, MainTab } from "@/components/store/MainTabs";
import { ItemsToolbar } from "@/components/store/ItemsToolbar";
import { BatchTrayView } from "@/components/store/BatchTrayView";
import { HqReviewBanner } from "@/components/store/HqReviewBanner";
import { BatchSplitButton } from "@/components/store/BatchSplitButton";
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
import { PricingItem } from "@/types/pricing";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";
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

  // Home is always All items — the director's permanent workspace. The HQ queue
  // is reached via the tab or the header bell (it empties; All items doesn't).
  const [activeTab, setActiveTab] = useState<MainTab>("all");
  const [view, setView] = useState<"items" | "batch">("items");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [newBatch, setNewBatch] = useState<{ open: boolean; seedIds: string[] }>({ open: false, seedIds: [] });
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

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
      { key: "priceType", label: "Price type", options: uniqueSorted(items.map((i) => PRICE_TYPE_META[i.category_type].label)) },
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
        const itemValue =
          key === "priceType" ? PRICE_TYPE_META[i.category_type].label : (i as unknown as Record<string, string>)[key];
        if (!opts.includes(itemValue)) return false;
      }
      return true;
    },
    [filters]
  );

  const rows = useMemo(() => {
    let list = activeTab === "hq" ? items.filter(hqReviewNeeded) : items;
    list = list.filter(matchesFilters);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeTab, matchesFilters, search]);

  // ── Selection ────────────────────────────────────────────────────────────
  const toggle = useCallback((row: PricingItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((i) => i.id))));
  }, [rows]);

  const columns = useMemo(
    () =>
      buildStoreColumns(
        {
          isSelected: (r) => selected.has(r.id),
          toggle,
          toggleAll,
          allSelected: rows.length > 0 && selected.size === rows.length,
        },
        batches,
        visibleCols
      ),
    [selected, rows, toggle, toggleAll, batches, visibleCols]
  );

  const columnOptions = STORE_OPTIONAL_COLUMNS.map((c) => ({ ...c, visible: visibleCols.has(c.id) }));
  const onToggleColumn = (id: string, visible: boolean) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      visible ? next.add(id) : next.delete(id);
      return next;
    });

  // ── Drawer navigation across the current list ─────────────────────────────
  const rowIds = rows.map((r) => r.id);
  const drawerIdx = drawerItemId ? rowIds.indexOf(drawerItemId) : -1;
  const onPrev = drawerIdx > 0 ? () => setDrawerItemId(rowIds[drawerIdx - 1]) : undefined;
  const onNext = drawerIdx >= 0 && drawerIdx < rowIds.length - 1 ? () => setDrawerItemId(rowIds[drawerIdx + 1]) : undefined;

  // Override ids for the selected items that are still pending (batchable).
  const selectedPendingIds = useMemo(
    () => overrides.filter((o) => selected.has(o.itemId) && o.status === "pending").map((o) => o.id),
    [overrides, selected]
  );

  const openNewBatch = (seedIds: string[]) => setNewBatch({ open: true, seedIds });

  // Add specific override ids to a batch — shared by the drawer (one item) and the
  // bulk bar (the selection). Makes that batch active and offers a one-click Undo.
  const addOverridesToBatch = useCallback(
    (batchId: string, overrideIds: string[]) => {
      if (overrideIds.length === 0) {
        toast.error("No edits to batch");
        return;
      }
      addToBatch(batchId, overrideIds);
      setActiveBatchId(batchId);
      const name = usePricingStore.getState().batches.find((b) => b.id === batchId)?.name ?? "batch";
      toast.success(`Added to ${name}`, {
        description: `${overrideIds.length} price change${overrideIds.length !== 1 ? "s" : ""}`,
        action: { label: "Undo", onClick: () => overrideIds.forEach((id) => removeFromBatch(id)) },
      });
    },
    [addToBatch, removeFromBatch, toast]
  );

  const handleBulkAddToBatch = (batchId: string) => {
    if (selectedPendingIds.length === 0) {
      toast.error("Selected items have no edits to batch");
      return;
    }
    addOverridesToBatch(batchId, selectedPendingIds);
    setSelected(new Set());
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        hqCount={hqCount}
        onViewHq={() => {
          setView("items");
          setActiveTab("hq");
        }}
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <StorePricingHeader />
          <div className="relative order-2 ml-auto inline-flex md:order-3">
            <Button
              // Gain emphasis once there are changes waiting — the send step is
              // the flow's terminal action, so a tertiary button under-sells it.
              variant={view === "batch" || trayCount > 0 ? "secondary" : "tertiary"}
              iconLeft={Layers}
              pressed={view === "batch"}
              onClick={() => setView((v) => (v === "batch" ? "items" : "batch"))}
            >
              To send
            </Button>
            {trayCount > 0 && (
              <span key={trayPulse} className="badge-pop absolute -top-1.5 -right-1.5 pointer-events-none">
                <CountBadge count={trayCount} tone="warning" />
              </span>
            )}
          </div>
        </div>

        {view === "batch" ? (
          <>
            <div className="mt-6">
              <Button variant="tertiary" iconLeft={ArrowLeft} onClick={() => setView("items")}>
                Back to items
              </Button>
            </div>
            <div className="mt-4">
              <BatchTrayView onNewBatch={openNewBatch} activeBatchId={activeBatchId} onSetActiveBatch={setActiveBatchId} />
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 overflow-x-auto">
                <MainTabs value={activeTab} onChange={setActiveTab} allCount={TOTAL_ITEM_COUNT} hqCount={hqCount} />
              </div>
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

            <div className="mt-4">
              {activeTab === "hq" && hqCount > 0 && (
                <div className="mb-4">
                  <HqReviewBanner count={hqCount} />
                </div>
              )}
              {rows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No items match"
                  hint={
                    activeTab === "hq"
                      ? "No HQ recommendations for this filter."
                      : "Try a different search or clear the filters."
                  }
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
                        checked={rows.length > 0 && selected.size === rows.length}
                        onCheckedChange={toggleAll}
                        aria-label="Select all items"
                      />
                      <span className="text-sm text-gray-600">
                        {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                      </span>
                    </div>
                    <MobileItemList
                      rows={rows}
                      batches={batches}
                      isSelected={(r) => selected.has(r.id)}
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
              )}
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
        flow={activeTab}
        activeBatch={activeBatch}
        openBatches={openBatches}
        onAddToBatch={addOverridesToBatch}
        onNewBatch={openNewBatch}
        onClose={() => setDrawerItemId(null)}
        onPrev={onPrev}
        onNext={onNext}
        position={drawerIdx >= 0 ? { index: drawerIdx, total: rowIds.length } : undefined}
      />

      <NewBatchModal
        open={newBatch.open}
        onOpenChange={(open) => setNewBatch((p) => ({ ...p, open }))}
        candidates={pending}
        initialSelectedIds={newBatch.seedIds}
        onCreate={(name, ids) => {
          createBatch(name, ids);
          // The new batch is appended last; make it the active one.
          const all = usePricingStore.getState().batches;
          setActiveBatchId(all[all.length - 1]?.id ?? null);
          toast.success(`Batch "${name}" created`, {
            description: `${ids.length} price change${ids.length !== 1 ? "s" : ""} grouped`,
          });
          setSelected(new Set());
        }}
      />

      {selected.size > 0 && view === "items" && (
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
            <BatchSplitButton
              size="sm"
              activeBatch={activeBatch}
              openBatches={openBatches}
              onAddToActive={() => activeBatch && handleBulkAddToBatch(activeBatch.id)}
              onAddToBatch={(id) => {
                setActiveBatchId(id);
                handleBulkAddToBatch(id);
              }}
              onNewBatch={() => openNewBatch(selectedPendingIds)}
              disabled={selectedPendingIds.length === 0}
            />
          </ActionBarActions>
        </ActionBar>
      )}
    </div>
  );
}
