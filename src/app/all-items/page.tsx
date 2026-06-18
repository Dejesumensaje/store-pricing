"use client";

import { useMemo, useState, useCallback } from "react";
import { PricingShell } from "@/components/layout/PricingShell";
import { ChangeTypeNav } from "@/components/pricing-table/ChangeTypeNav";
import { StatusSegments, StatusSegmentKey, SEGMENT_ICONS } from "@/components/pricing-table/StatusSegments";
import { DataTable } from "@/components/pricing-table/DataTable";
import { buildAllItemsColumns } from "@/components/pricing-table/columns/allItemsColumns";
import { usePricingStore } from "@/store/pricing-store";
import { mockAllItems } from "@/lib/mock-data";
import { PricingItem } from "@/types/pricing";
import { SearchInput, Button } from "@dejesumensaje/converge-ds-experimental";
import { SlidersHorizontal, Columns3 } from "lucide-react";

export default function AllItemsPage() {
  const { overrides } = usePricingStore();
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<StatusSegmentKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pendingCount = overrides.filter((o) => o.status === "pending").length;
  const pendingSendCount = overrides.filter((o) => o.status !== "submitted").length;

  const segments = useMemo(
    () => [
      { key: "pending_send" as StatusSegmentKey, label: "overrides pending send", count: pendingSendCount, icon: SEGMENT_ICONS.pending_send },
    ],
    [pendingSendCount]
  );

  const items = useMemo(() => {
    let list = mockAllItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [search]);

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

  return (
    <PricingShell pendingCount={pendingCount}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <ChangeTypeNav active="all" />
        <div className="flex items-center gap-2 shrink-0">
          <SearchInput value={search} onValueChange={setSearch} aria-label="Search items" className="w-56" />
          <Button variant="tertiary" size="sm" iconLeft={Columns3} aria-label="Column settings" />
          <Button variant="tertiary" size="sm" iconLeft={SlidersHorizontal} aria-label="Filters" />
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
    </PricingShell>
  );
}
