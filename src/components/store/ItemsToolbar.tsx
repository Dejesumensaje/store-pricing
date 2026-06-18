"use client";

import { SearchInput, Button } from "@dejesumensaje/converge-ds-experimental";
import { SlidersHorizontal } from "lucide-react";
import { ColumnsMenu, ColumnOption } from "../pricing-table/ColumnsMenu";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  onOpenFilter: () => void;
  activeFilterCount: number;
  columnOptions: ColumnOption[];
  onToggleColumn: (id: string, visible: boolean) => void;
};

export function ItemsToolbar({ search, onSearch, onOpenFilter, activeFilterCount, columnOptions, onToggleColumn }: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <SearchInput
        value={search}
        onValueChange={onSearch}
        expandDirection="left"
        aria-label="Search items"
        placeholder="Search by name or ID"
        className="w-56"
      />
      <Button
        variant={activeFilterCount > 0 ? "secondary" : "tertiary"}
        size="sm"
        iconLeft={SlidersHorizontal}
        aria-label="Filters"
        onClick={onOpenFilter}
      >
        {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
      </Button>
      <ColumnsMenu options={columnOptions} onToggle={onToggleColumn} />
    </div>
  );
}
