"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Button,
  Select,
  ActionBar,
  ActionBarLeading,
  ActionBarActions,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { Tag } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorePricingHeader } from "@/components/store/StorePricingHeader";
import { MainTabs, MainTab } from "@/components/store/MainTabs";
import { ItemsToolbar } from "@/components/store/ItemsToolbar";
import { BatchTrayView } from "@/components/store/BatchTrayView";
import { BatchSplitButton } from "@/components/store/BatchSplitButton";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildStoreColumns, STORE_OPTIONAL_COLUMNS } from "@/components/store/buildStoreColumns";
import { ItemEditDrawer } from "@/components/pricing-table/ItemEditDrawer";
import { FilterDrawer, FilterFacet, FilterValue } from "@/components/filters/FilterDrawer";
import { NewBatchModal } from "@/components/pending/NewBatchModal";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { TOTAL_ITEM_COUNT } from "@/lib/mock-data";
import { PricingItem, PricingCategory } from "@/types/pricing";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";

const PRICE_TYPE_OPTIONS = (Object.keys(PRICE_TYPE_META) as PricingCategory[]).map((key) => ({
  label: PRICE_TYPE_META[key].label,
  value: key,
}));

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

// An item HQ wants changed that the store hasn't acted on yet.
const hqSuggests = (i: PricingItem) =>
  !i.reviewed && i.newBasePrice == null && i.recommendedBasePrice !== i.currentBasePrice;

export default function StorePricingPage() {
  const toast = useToast();
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const createBatch = usePricingStore((s) => s.createBatch);
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);

  const [activeTab, setActiveTab] = useState<MainTab>("all");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [newBatch, setNewBatch] = useState<{ open: boolean; seedIds: string[] }>({ open: false, seedIds: [] });
  const [applyType, setApplyType] = useState<PricingCategory | "">("");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const trayCount = overrides.filter((o) => o.status === "pending" || o.status === "in_batch").length;
  const hqCount = useMemo(() => items.filter(hqSuggests).length, [items]);

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
    let list = activeTab === "hq" ? items.filter(hqSuggests) : items;
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
        visibleCols,
        (item) => setDrawerItemId(item.id)
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

  const handleBulkAddToBatch = (batchId: string) => {
    if (selectedPendingIds.length === 0) {
      toast.error("Selected items have no edits to batch");
      return;
    }
    addToBatch(batchId, selectedPendingIds);
    toast.success(`Added ${selectedPendingIds.length} change${selectedPendingIds.length !== 1 ? "s" : ""} to batch`);
    setSelected(new Set());
  };

  const handleApplyType = () => {
    if (!applyType || selected.size === 0) return;
    selected.forEach((id) => updatePriceType(id, applyType));
    toast.success(`Applied "${PRICE_TYPE_META[applyType].label}" to ${selected.size} item${selected.size !== 1 ? "s" : ""}`);
    setSelected(new Set());
    setApplyType("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader alertCount={trayCount} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-6">
        <StorePricingHeader />

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0 overflow-x-auto">
            <MainTabs
              value={activeTab}
              onChange={setActiveTab}
              allCount={TOTAL_ITEM_COUNT}
              hqCount={hqCount}
              batchCount={trayCount}
            />
          </div>
          {activeTab !== "batch" && (
            <ItemsToolbar
              search={search}
              onSearch={setSearch}
              onOpenFilter={() => setFilterOpen(true)}
              activeFilterCount={activeFilterCount}
              columnOptions={columnOptions}
              onToggleColumn={onToggleColumn}
            />
          )}
        </div>

        <div className="mt-4">
          {activeTab === "batch" ? (
            <BatchTrayView onNewBatch={openNewBatch} activeBatchId={activeBatchId} onSetActiveBatch={setActiveBatchId} />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              flat
              isSelected={(r) => selected.has(r.id)}
              isOverride={(r) => r.hasOverride}
              onRowClick={(r) => setDrawerItemId(r.id)}
            />
          )}
        </div>
      </main>

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} facets={facets} value={filters} onApply={setFilters} />

      <ItemEditDrawer
        itemId={drawerItemId}
        onClose={() => setDrawerItemId(null)}
        onPrev={onPrev}
        onNext={onNext}
        position={drawerIdx >= 0 ? { index: drawerIdx, total: rowIds.length } : undefined}
        activeBatchId={activeBatchId}
        onSetActiveBatch={setActiveBatchId}
        onNewBatch={openNewBatch}
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

      {selected.size > 0 && activeTab !== "batch" && (
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
            <div className="w-44">
              <Select
                label="Price type"
                size="sm"
                options={PRICE_TYPE_OPTIONS}
                value={applyType}
                onChange={(v) => setApplyType(v as PricingCategory)}
                placeholder="Apply price type…"
              />
            </div>
            <Button variant="secondary" size="sm" iconLeft={Tag} disabled={!applyType} onClick={handleApplyType}>
              Apply
            </Button>
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
