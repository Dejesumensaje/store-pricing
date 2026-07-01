"use client";

import { useState } from "react";
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
  const [focused, setFocused] = useState(false);
  // Mirror the DS SearchInput's own rule: it stays expanded while focused OR
  // while it holds a value. We read this off React focus events (caught on the
  // display:contents wrapper, so we don't clobber the DS's internal focus
  // handlers on the input itself).
  const isOpen = focused || search.length > 0;

  return (
    // Mobile: search pinned left, actions clustered right (justify-between).
    // Desktop: the whole toolbar sits at the right of the tabs row, items inline.
    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
      {/* display:contents lets the SearchInput sit directly in the flex row
          while this wrapper still receives the input's bubbled focus events. */}
      <div
        style={{ display: "contents" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <SearchInput
          value={search}
          onValueChange={onSearch}
          size="sm"
          expandDirection="right"
          aria-label="Search items"
          placeholder="Search by name or ID"
          // The DS pins width via an inline style (200px when expanded), which
          // clips the placeholder. On desktop always stay expanded at 300px
          // so the placeholder is visible; on mobile only expand when open.
          className={isOpen ? "w-full! md:w-[300px]!" : "md:w-[300px]!"}
        />
      </div>
      {/* On mobile, collapse the action cluster while search is open so the
          input owns the full row. Desktop (md:flex) always shows it. */}
      <div className={`items-center gap-2 md:flex ${isOpen ? "hidden" : "flex"}`}>
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
