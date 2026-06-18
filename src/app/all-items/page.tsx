"use client";

import { useMemo, useState, useCallback } from "react";
import { PricingShell } from "@/components/layout/PricingShell";
import { ChangeTypeNav } from "@/components/pricing-table/ChangeTypeNav";
import { StatusSegments, StatusSegmentKey, SEGMENT_ICONS } from "@/components/pricing-table/StatusSegments";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildAllItemsColumns } from "@/components/pricing-table/columns/allItemsColumns";
import { FilterDrawer, FilterFacet, FilterValue } from "@/components/filters/FilterDrawer";
import { usePricingStore } from "@/store/pricing-store";
import { mockAllItems } from "@/lib/mock-data";
import { PricingItem, PricingCategory } from "@/types/pricing";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";
import {
  SearchInput,
  Button,
  Select,
  ActionBar,
  ActionBarLeading,
  ActionBarActions,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { SlidersHorizontal, Columns3, Tag } from "lucide-react";

const PRICE_TYPE_OPTIONS = (Object.keys(PRICE_TYPE_META) as PricingCategory[]).map((key) => ({
  label: PRICE_TYPE_META[key].label,
  value: key,
}));

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export default function AllItemsPage() {
  const { overrides } = usePricingStore();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<StatusSegmentKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValue>({});
  // Price-type changes applied from this view (overlay on the static catalog).
  const [priceTypeMap, setPriceTypeMap] = useState<Record<string, PricingCategory>>({});
  const [applyType, setApplyType] = useState<PricingCategory | "">("");

  const pendingCount = overrides.filter((o) => o.status === "pending").length;
  const pendingSendCount = overrides.filter((o) => o.status !== "submitted").length;

  const segments = useMemo(
    () => [
      { key: "pending_send" as StatusSegmentKey, label: "overrides pending send", count: pendingSendCount, icon: SEGMENT_ICONS.pending_send },
    ],
    [pendingSendCount]
  );

  // Apply the price-type overlay so badges reflect changes made here.
  const catalog = useMemo(
    () =>
      mockAllItems.map((i) =>
        priceTypeMap[i.id] ? { ...i, category_type: priceTypeMap[i.id] } : i
      ),
    [priceTypeMap]
  );

  const facets: FilterFacet[] = useMemo(
    () => [
      { key: "brand", label: "Brand", options: uniqueSorted(catalog.map((i) => i.brand)) },
      { key: "category", label: "Category", options: uniqueSorted(catalog.map((i) => i.category)) },
      { key: "itemRole", label: "Item role", options: uniqueSorted(catalog.map((i) => i.itemRole)) },
      { key: "nationalVsStore", label: "National vs. store", options: uniqueSorted(catalog.map((i) => i.nationalVsStore)) },
      { key: "sensitivity", label: "Sensitivity", options: uniqueSorted(catalog.map((i) => i.sensitivity)) },
      { key: "priceType", label: "Price type", options: uniqueSorted(catalog.map((i) => PRICE_TYPE_META[i.category_type].label)) },
    ],
    [catalog]
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

  const items = useMemo(() => {
    let list = catalog.filter(matchesFilters);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [catalog, matchesFilters, search]);

  const toggle = useCallback((row: PricingItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }, [items]);

  const columns = useMemo(
    () =>
      buildAllItemsColumns({
        isSelected: (r) => selected.has(r.id),
        toggle,
        toggleAll,
        allSelected: items.length > 0 && selected.size === items.length,
      }),
    [selected, items, toggle, toggleAll]
  );

  const handleApplyType = () => {
    if (!applyType || selected.size === 0) return;
    setPriceTypeMap((prev) => {
      const next = { ...prev };
      selected.forEach((id) => (next[id] = applyType));
      return next;
    });
    const meta = PRICE_TYPE_META[applyType];
    toast.success(`Applied "${meta.label}" to ${selected.size} item${selected.size !== 1 ? "s" : ""}`, {
      description: `Edit them in the ${meta.label} queue.`,
    });
    setSelected(new Set());
    setApplyType("");
  };

  return (
    <PricingShell pendingCount={pendingCount}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <ChangeTypeNav active="all" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SearchInput value={search} onValueChange={setSearch} aria-label="Search items" className="w-56" />
          <Button variant="tertiary" size="sm" iconLeft={Columns3} aria-label="Column settings" />
          <Button
            variant={activeFilterCount > 0 ? "secondary" : "tertiary"}
            size="sm"
            iconLeft={SlidersHorizontal}
            onClick={() => setFilterOpen(true)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <StatusSegments segments={segments} active={activeSegment} onChange={setActiveSegment} />
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          isSelected={(r) => selected.has(r.id)}
        />
      </div>

      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        facets={facets}
        value={filters}
        onApply={setFilters}
      />

      {selected.size > 0 && (
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
            <div className="w-56">
              <Select
                label="Price type"
                size="sm"
                options={PRICE_TYPE_OPTIONS}
                value={applyType}
                onChange={(v) => setApplyType(v as PricingCategory)}
                placeholder="Apply price type…"
              />
            </div>
            <Button variant="primary" size="sm" iconLeft={Tag} disabled={!applyType} onClick={handleApplyType}>
              Apply
            </Button>
          </ActionBarActions>
        </ActionBar>
      )}
    </PricingShell>
  );
}
