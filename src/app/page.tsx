"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  CountBadge,
  ToggleGroup,
  useToast,
} from "@dejesumensaje/converge-ds-experimental";
import { SearchX } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StorePricingHeader } from "@/components/store/StorePricingHeader";
import { ItemsToolbar } from "@/components/store/ItemsToolbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildStoreColumns, STORE_OPTIONAL_COLUMNS } from "@/components/store/buildStoreColumns";
import { ItemEditDrawer } from "@/components/pricing-table/ItemEditDrawer";
import { FilterDrawer, FilterFacet, FilterValue } from "@/components/filters/FilterDrawer";
import { FilterChips } from "@/components/filters/FilterChips";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { TOTAL_ITEM_COUNT } from "@/lib/mock-data";
import { PricingItem, HqBaseReason, HqPromoReason } from "@/types/pricing";
import { pricingStrategyFullLabel, itemChangeGroups, CHANGE_FILTER_OPTIONS } from "@/lib/change-summary";
import { hqReviewNeeded } from "@/lib/item-status";
import { REASON_META } from "@/lib/price-change-reason";
import { itemIdsOverEdlpCeiling } from "@/lib/edlp-ceiling";

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

// Only include a facet definition when its backing data is actually present,
// so it never shows as a dead option on a clean seed.
const maybeFacet = (present: boolean, facet: FilterFacet): FilterFacet[] => (present ? [facet] : []);

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
  const overrides = usePricingStore((s) => s.overrides);
  const edlpException = useEdlpException();

  // The active view lens over All items — segmented, not separate screens. HQ
  // review is an in-place filter over the same table; decisions happen in the
  // row drawer, just like any other edit.
  const [storeView, setStoreView] = useState<"all" | "hq">("all");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);

  const hqCount = useMemo(() => items.filter(hqReviewNeeded).length, [items]);
  // View-lens segments. "All items" is always present; the HQ lens appears only
  // when it has items (no dead, empty tab).
  const viewOptions = useMemo(
    () => [
      { value: "all", label: "All items" },
      ...(hqCount > 0 ? [{ value: "hq", label: `HQ recs (${hqCount})` }] : []),
    ],
    [hqCount]
  );

  // Toast once when the last HQ recommendation is reviewed (hqCount drops to 0
  // while the director is in the review flow). The ref is initialised to hqCount
  // so we never fire on the very first render when hqCount may already be 0.
  const prevHqCount = useRef(hqCount);
  useEffect(() => {
    if (prevHqCount.current > 0 && hqCount === 0 && storeView === "hq") {
      toast.success("All HQ recommendations reviewed.");
    }
    prevHqCount.current = hqCount;
  }, [hqCount, storeView, toast]);

  // EDLP items currently priced over their SAP PMR maximum (soft or hard,
  // exception or not) — powers the "Over EDLP max" facet, same pattern.
  const edlpCeilingIds = useMemo(
    () => itemIdsOverEdlpCeiling(items, edlpException),
    [items, edlpException]
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
      // the review queue by reason without the reason crowding the rows. Pulls
      // from all three sections' HQ reasons, since an item can carry more than one.
      { key: "hqReason", label: "HQ reason", options: uniqueSorted(
        items.filter(hqReviewNeeded)
          .flatMap((i) => [i.hqBaseReason, i.hqRetailReason, i.hqFuelReason])
          .filter((r): r is HqBaseReason | HqPromoReason => r != null)
          .map((r) => REASON_META[r].label)
      ) },
      { key: "brand", label: "Brand", options: uniqueSorted(items.map((i) => i.brand)) },
      { key: "category", label: "Category", options: uniqueSorted(items.map((i) => i.category)) },
      { key: "itemRole", label: "Item role", options: uniqueSorted(items.map((i) => i.itemRole)) },
      { key: "nationalVsStore", label: "National vs. store", options: uniqueSorted(items.map((i) => i.nationalVsStore)) },
      { key: "sensitivity", label: "Sensitivity", options: uniqueSorted(items.map((i) => i.sensitivity)) },
      { key: "strategy", label: "Pricing strategy", options: uniqueSorted(items.map(pricingStrategyFullLabel)) },
      ...maybeFacet(items.some((i) => i.hasAlert), { key: "hasAlert", label: "Alerts", options: ["Flagged"] }),
      ...maybeFacet(edlpCeilingIds.size > 0, { key: "edlpCeiling", label: "Over EDLP max", options: ["Over the SAP maximum"] }),
    ],
    [items, edlpCeilingIds]
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
          // Matches if ANY of the item's section reasons is selected.
          const labels = [i.hqBaseReason, i.hqRetailReason, i.hqFuelReason]
            .filter((r): r is HqBaseReason | HqPromoReason => r != null)
            .map((r) => REASON_META[r].label);
          if (!labels.some((l) => opts.includes(l))) return false;
          continue;
        }
        // Boolean facets: the generic string-equality branch below would
        // silently no-op on these (opts.includes() against a boolean, or
        // against a key that isn't a PricingItem property at all).
        if (key === "hasAlert") {
          if (!i.hasAlert) return false;
          continue;
        }
        if (key === "edlpCeiling") {
          if (!edlpCeilingIds.has(i.id)) return false;
          continue;
        }
        const itemValue =
          key === "strategy" ? pricingStrategyFullLabel(i) : (i as unknown as Record<string, string>)[key];
        if (!opts.includes(itemValue)) return false;
      }
      return true;
    },
    [filters, edlpCeilingIds]
  );

  // When each item was last edited — so recently-decided items rise to the top of
  // All items (the director sees what they just touched without hunting).
  const activeAtById = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) {
      if (o.status === "pending") {
        m.set(o.itemId, Math.max(m.get(o.itemId) ?? 0, o.updatedAt ?? 0));
      }
    }
    return m;
  }, [overrides]);

  // The HQ review lens is only "live" while recommendations remain — once the last
  // one is decided it falls away on its own, so the director isn't left staring at
  // an empty table (no effect/setState needed; it's derived).
  const reviewActive = storeView === "hq" && hqCount > 0;
  // The effective lens: HQ falls back to "all" once its queue empties.
  const activeView = storeView === "hq" && hqCount === 0 ? "all" : storeView;
  // Per-view heading. The toggle handles navigation and counts; per-reason
  // filtering lives in the Filters drawer (the old reason breakdown line was
  // dropped per V1 feedback — noise at the top of the page).
  const viewInfo = {
    all: { title: "All items" },
    hq: { title: "HQ recommendations" },
  }[activeView];

  const rows = useMemo(() => {
    let list = items;
    // Narrow to the active view lens (HQ review queue), then apply facet filters
    // + search on top.
    if (activeView === "hq") list = list.filter(hqReviewNeeded);
    list = list.filter(matchesFilters);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    // Recent-first: items with an active edit float to the top, newest first;
    // everything else keeps its order (V8 sort is stable).
    return [...list].sort((a, b) => (activeAtById.get(b.id) ?? 0) - (activeAtById.get(a.id) ?? 0));
  }, [items, activeView, matchesFilters, search, activeAtById]);

  // The table is read-only — every decision is made in the drawer and applied
  // directly, so there's no row selection / bulk bar.
  const columns = useMemo(() => buildStoreColumns(visibleCols), [visibleCols]);

  const columnOptions = STORE_OPTIONAL_COLUMNS.map((c) => ({ ...c, visible: visibleCols.has(c.id) }));
  const onToggleColumn = (id: string, visible: boolean) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      visible ? next.add(id) : next.delete(id);
      return next;
    });

  return (
    <>
    {/* Desktop-identical at ≥48rem — the mobile surface below is a wholly
        separate, scan-first experience (MobileShell), not a shrunken version
        of this tree. */}
    <div id="main-content" className="hidden h-full flex-col bg-gray-50 md:flex">
      <AppHeader
        hqCount={hqCount}
        onViewHq={() => {
          if (hqCount > 0) setStoreView("hq");
        }}
      />

      {/* Mobile: main never scrolls — the store header + view controls stay pinned
          and only the item list scrolls (keeps context). Desktop keeps its own
          auto-scroll (the DataTable already scrolls internally). */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 flex flex-col min-h-0 overflow-hidden md:overflow-auto px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <StorePricingHeader />
        </div>

        <>
            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* On mobile the "View" dropdown below is the labeled switcher, so
                  the heading would just duplicate it — hide it there when a dropdown
                  exists. With no dropdown (clean store) the heading always shows. */}
              <h2 className={`${viewOptions.length > 1 ? "hidden md:flex" : "flex"} flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold text-gray-900`}>
                <span>{viewInfo.title}</span>
                {/* A view's own size reads as a small badge (5, 13…); the total
                    catalog count and the "N of M" filtered form stay plain text. */}
                {activeView !== "all" && !(activeFilterCount > 0 || search) ? (
                  <CountBadge count={rows.length} tone="neutral" />
                ) : (
                  <span className="text-sm font-normal text-gray-400">
                    {activeFilterCount > 0 || search
                      ? `${rows.length} of ${TOTAL_ITEM_COUNT.toLocaleString()}`
                      : TOTAL_ITEM_COUNT.toLocaleString()}
                  </span>
                )}
              </h2>
              <ItemsToolbar
                search={search}
                onSearch={setSearch}
                onOpenFilter={() => setFilterOpen(true)}
                activeFilterCount={activeFilterCount}
                columnOptions={columnOptions}
                onToggleColumn={onToggleColumn}
              />
            </div>
            {/* View lens — shown only when there's more than "All items" to
                switch between (an HQ set exists). This whole tree is desktop-only
                now (see the `hidden md:flex` wrapper below), so the toggle needs
                no mobile fallback. */}
            {viewOptions.length > 1 && (
              <div className="mt-3 hidden md:block">
                <ToggleGroup
                  aria-label="Item view"
                  value={viewOptions.some((o) => o.value === storeView) ? storeView : "all"}
                  onValueChange={(v) => setStoreView(v as "all" | "hq")}
                  options={viewOptions}
                />
              </div>
            )}
            <div className="mt-4 flex-1 min-h-0 flex flex-col">
              {activeFilterCount > 0 && (
                <FilterChips facets={facets} value={filters} onChange={setFilters} />
              )}
              {rows.length === 0 ? (
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
                // Tablet/desktop only now — MobileShell renders its own scan-first
                // surface below `md`. flex-1 + min-h-0 lets DataTable's
                // h-full/overflow-auto create a real scroll container so sticky
                // headers work.
                <div className="flex flex-1 flex-col min-h-0">
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
              )}
            </div>
        </>
      </main>
    </div>

    <div className="md:hidden h-full" data-testid="mobile-shell">
      <MobileShell />
    </div>

    {/* Outside both branches: FilterDrawer/ItemEditDrawer portal, and fully
        unmount when closed, so nothing on mobile can open them anymore
        (there's no control left below `md` that calls setFilterOpen/setDrawerItemId). */}
    <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} facets={facets} value={filters} onApply={setFilters} />

    <ItemEditDrawer
      itemId={drawerItemId}
      onClose={() => setDrawerItemId(null)}
    />
    </>
  );
}
