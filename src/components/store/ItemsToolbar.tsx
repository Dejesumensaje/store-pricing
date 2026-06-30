"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Mirror the DS SearchInput open/close state by watching aria-hidden on the
  // internal input element — the DS sets aria-hidden=null on open, "true" on close.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const input = wrapper.querySelector<HTMLInputElement>('input[aria-label="Search items"]');
    if (!input) return;

    const sync = () => setIsSearchOpen(input.getAttribute("aria-hidden") !== "true");
    // Set initial state
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(input, { attributes: true, attributeFilter: ["aria-hidden"] });
    return () => observer.disconnect();
  }, []);

  return (
    // Mobile: search pinned left, actions clustered right (justify-between).
    // Desktop: the whole toolbar sits at the right of the tabs row, items inline.
    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
      <div
        ref={wrapperRef}
        data-testid="search-wrapper"
        className={`min-w-0 transition-[width,flex] duration-200 md:w-72 md:flex-none ${isSearchOpen ? "flex-1" : ""}`}
      >
        <SearchInput
          value={search}
          onValueChange={onSearch}
          size="sm"
          expandDirection="right"
          aria-label="Search items"
          placeholder="Search by name or ID"
          className="w-full"
        />
      </div>
      {/* On mobile, hide action buttons while the search is open to give the
          search input the full row width. On desktop (md:flex), always show. */}
      <div className={`items-center gap-2 md:flex ${isSearchOpen ? "hidden" : "flex"}`}>
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
