"use client";

import { SearchInput, Button, Tooltip, CountBadge } from "@dejesumensaje/converge-ds-experimental";
import { ListFilter } from "lucide-react";
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
    // Mobile: search pinned left, actions clustered right (justify-between).
    // Desktop: the whole toolbar sits at the right of the tabs row, items inline.
    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
      {/*
        search-widget: CSS hook. globals.css uses :has(input[tabindex="0"]) on
        this class to detect when the DS has expanded (the DS sets tabIndex=0
        on its hidden input only when open). Width override lives there too —
        as unlayered !important CSS so it beats the DS inline style.
        flex-1 md:flex-none: on mobile the wrapper grows to fill the row so
        width:100% on the DS root resolves to full container width.
      */}
      <div className="search-widget">
        <SearchInput
          value={search}
          onValueChange={onSearch}
          size="sm"
          expandDirection="right"
          aria-label="Search items"
          placeholder="Search by name or ID"
        />
      </div>
      {/*
        search-actions: CSS hook. globals.css hides this on mobile while the
        search is open (:has selector on the sibling .search-widget), always
        visible on desktop.
      */}
      <div className="search-actions flex items-center gap-2">
        {/* Icon-only with a tooltip; the active-filter count rides as a badge
            (label removed to match the columns action's compact register). */}
        <Tooltip content="Filters">
          <span className="relative inline-flex">
            <Button
              variant={activeFilterCount > 0 ? "secondary" : "tertiary"}
              size="sm"
              iconLeft={ListFilter}
              aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
              onClick={onOpenFilter}
            />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 pointer-events-none">
                <CountBadge count={activeFilterCount} tone="neutral" />
              </span>
            )}
          </span>
        </Tooltip>
        <ColumnsMenu options={columnOptions} onToggle={onToggleColumn} />
      </div>
    </div>
  );
}
