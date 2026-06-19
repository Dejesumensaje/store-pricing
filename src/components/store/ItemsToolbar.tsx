"use client";

import { SearchInput, Button } from "@dejesumensaje/converge-ds-experimental";
import { SlidersHorizontal, ScanLine } from "lucide-react";
import { ColumnsMenu, ColumnOption } from "../pricing-table/ColumnsMenu";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  onOpenFilter: () => void;
  onScan: () => void;
  activeFilterCount: number;
  columnOptions: ColumnOption[];
  onToggleColumn: (id: string, visible: boolean) => void;
};

export function ItemsToolbar({ search, onSearch, onOpenFilter, onScan, activeFilterCount, columnOptions, onToggleColumn }: Props) {
  return (
    // Mobile: search pinned left, actions clustered right (justify-between).
    // Desktop: the whole toolbar sits at the right of the tabs row, items inline.
    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
      <SearchInput
        value={search}
        onValueChange={onSearch}
        size="sm"
        expandDirection="right"
        aria-label="Search items"
        placeholder="Search by name or ID"
        className="md:w-56"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          iconLeft={ScanLine}
          className="md:hidden"
          onClick={onScan}
        >
          Scan
        </Button>
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
    </div>
  );
}
