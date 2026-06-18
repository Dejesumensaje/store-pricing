"use client";

import { useMemo, useState, useCallback } from "react";
import { PricingShell } from "@/components/layout/PricingShell";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildTempColumns, TempColumnVisibility } from "@/components/pricing-table/columns/tempColumns";
import { ItemEditDrawer } from "@/components/pricing-table/ItemEditDrawer";
import { ChangeTypeNav } from "@/components/pricing-table/ChangeTypeNav";
import { ColumnsMenu } from "@/components/pricing-table/ColumnsMenu";
import { StatusSegments, StatusSegmentKey, SEGMENT_ICONS } from "@/components/pricing-table/StatusSegments";
import { usePricingStore } from "@/store/pricing-store";
import { needsDecision } from "@/lib/pricing-meta";
import { PricingItem } from "@/types/pricing";
import { SearchInput } from "@dejesumensaje/converge-ds-experimental";

export default function TempAllowancePage() {
  const { tempAllowanceItems, overrides } = usePricingStore();
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<StatusSegmentKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<TempColumnVisibility>({
    fuelSaver: false,
    dates: true,
  });

  const pendingCount = overrides.filter((o) => o.status === "pending").length;
  const overrideCount = tempAllowanceItems.filter((i) => i.hasOverride).length;
  const pendingSendCount = overrides.filter((o) => o.status !== "submitted").length;

  const segments = useMemo(
    () => [
      { key: "new_from_hq" as StatusSegmentKey, label: "new allowances from HQ", count: 10, icon: SEGMENT_ICONS.new_from_hq },
      { key: "overrides" as StatusSegmentKey, label: "allowance overrides", count: overrideCount, icon: SEGMENT_ICONS.overrides },
      { key: "alerts" as StatusSegmentKey, label: "alerts", count: 5, icon: SEGMENT_ICONS.alerts },
      { key: "pending_send" as StatusSegmentKey, label: "pending send", count: pendingSendCount, icon: SEGMENT_ICONS.pending_send },
    ],
    [overrideCount, pendingSendCount]
  );

  const items = useMemo(() => {
    let list = tempAllowanceItems;
    if (activeSegment === "overrides") list = list.filter((i) => i.hasOverride);
    if (activeSegment === "alerts") list = list.filter((i) => i.hasAlert);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [tempAllowanceItems, activeSegment, search]);

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
      buildTempColumns(
        {
          isSelected: (r) => selected.has(r.id),
          toggle,
          toggleAll,
          allSelected: items.length > 0 && selected.size === items.length,
        },
        visibleCols
      ),
    [selected, items, toggle, toggleAll, visibleCols]
  );

  // Edit queue — Prev/Next step through items that still need a decision.
  const queue = useMemo(() => items.filter((i) => needsDecision(i, "temp")), [items]);
  const activeItem = items.find((i) => i.id === activeItemId) ?? null;
  const step = useCallback(
    (dir: 1 | -1) => {
      const from = activeItemId ? items.findIndex((i) => i.id === activeItemId) : -1;
      for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
        if (needsDecision(items[i], "temp")) return items[i].id;
      }
      return null;
    },
    [items, activeItemId]
  );
  const nextId = step(1);
  const prevId = step(-1);

  return (
    <PricingShell pendingCount={pendingCount}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <ChangeTypeNav active="temporary_allowance" />
        <div className="flex items-center gap-2 shrink-0">
          <SearchInput value={search} onValueChange={setSearch} aria-label="Search items" className="w-56" />
          <ColumnsMenu
            options={[
              { id: "fuelSaver", label: "Fuel saver", visible: visibleCols.fuelSaver },
              { id: "dates", label: "Start – End date", visible: visibleCols.dates },
            ]}
            onToggle={(id, visible) => setVisibleCols((prev) => ({ ...prev, [id]: visible }))}
          />
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
          isOverride={(r) => r.hasOverride}
          flat
          onRowClick={(r) => setActiveItemId(r.id)}
        />
      </div>

      <ItemEditDrawer
        item={activeItem}
        variant="temp"
        remaining={queue.length}
        onClose={() => setActiveItemId(null)}
        onPrev={prevId ? () => setActiveItemId(prevId) : undefined}
        onNext={nextId ? () => setActiveItemId(nextId) : undefined}
      />
    </PricingShell>
  );
}
