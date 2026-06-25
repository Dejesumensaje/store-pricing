"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderGroup,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@dejesumensaje/converge-ds-experimental";

export type ColumnGroup = "item" | "pricing" | "impact";

export type DataColumn<T> = {
  id: string;
  header: React.ReactNode;
  width: number;
  group: ColumnGroup;
  /** Optional second-level label within the pricing group (e.g. "Base" / "Retail").
   *  Contiguous columns sharing a subgroup render under one group header. */
  subgroup?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  /** Rendered inside TableCell (escape-hatch children). */
  cell: (row: T) => React.ReactNode;
};

// Background per group — pinned cells need an opaque bg so scrolled item
// columns don't show through. Mirrors the Figma group colors.
const GROUP_BG: Record<ColumnGroup, string> = {
  item: "bg-white",
  pricing: "bg-[var(--color-group-pricing-bg)]",
  impact: "bg-[var(--color-group-impact-bg)]",
};
const GROUP_HEADER_BG: Record<ColumnGroup, string> = {
  item: "bg-gray-50",
  pricing: "bg-[var(--color-group-pricing-header)]",
  impact: "bg-[var(--color-group-impact-header)]",
};

type Segment<T> = {
  key: string;
  label: React.ReactNode;
  group: ColumnGroup;
  cols: DataColumn<T>[];
  width: number;
};

// Contiguous runs of (group, subgroup) → one group-header cell per run.
function segmentColumns<T>(
  cols: DataColumn<T>[],
  pricingGroupLabel?: React.ReactNode
): Segment<T>[] {
  const segs: Segment<T>[] = [];
  for (const c of cols) {
    const key = `${c.group}:${c.subgroup ?? ""}`;
    const last = segs[segs.length - 1];
    if (last && last.key === key) {
      last.cols.push(c);
      last.width += c.width;
    } else {
      const label =
        c.group === "impact" ? "Impact" : c.subgroup ?? pricingGroupLabel ?? " ";
      segs.push({ key, label, group: c.group, cols: [c], width: c.width });
    }
  }
  return segs;
}

type Props<T> = {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isSelected?: (row: T) => boolean;
  isOverride?: (row: T) => boolean;
  /** Marks rows still awaiting the director's HQ review — highlighted louder than
   *  a decided override so they stand out for action. */
  needsReview?: (row: T) => boolean;
  /** Group label rendered above the pricing columns (e.g. "Base price breakdown").
   *  Ignored for columns that declare a `subgroup`. */
  pricingGroupLabel?: string;
  /** When true, renders item columns in a scrollable left pane and pricing+impact in a fixed right pane. */
  splitPane?: boolean;
  /** Flat read-only table: same single-table layout but no horizontally-pinned
   *  pricing/impact columns. Group-header labels and the sticky top header stay. */
  flat?: boolean;
  /** Click handler for a body row (e.g. open the edit drawer). */
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isSelected,
  isOverride,
  needsReview,
  pricingGroupLabel,
  splitPane,
  flat,
  onRowClick,
}: Props<T>) {
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortAccessor) return rows;
    const acc = col.sortAccessor;
    return [...rows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sort, columns]);

  const toggleSort = (id: string) =>
    setSort((prev) =>
      prev?.id === id ? (prev.dir === "asc" ? { id, dir: "desc" } : null) : { id, dir: "asc" }
    );

  const syncScrollLeft = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rightPaneRef.current) rightPaneRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
  }, []);
  const syncScrollRight = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (leftPaneRef.current) leftPaneRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
  }, []);

  // ── Split-pane render path ───────────────────────────────────────────────────
  if (splitPane) {
    const itemCols = columns.filter((c) => c.group === "item");
    const rightCols = columns.filter((c) => c.group !== "item");
    const rightWidth = rightCols.reduce((s, c) => s + c.width, 0);
    const segments = segmentColumns(rightCols, pricingGroupLabel);
    // Columns that open a new segment get a left divider (e.g. Base | Retail).
    const segmentStartIds = new Set(segments.slice(1).map((s) => s.cols[0].id));
    const segDivider = (id: string) => (segmentStartIds.has(id) ? "border-l border-gray-200" : "");
    const firstPinnedShadow = "shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.08)]";

    return (
      <div className="flex h-full overflow-hidden border border-gray-200 rounded-xl bg-white">
        {/* Left pane — item columns, horizontal scroll */}
        <div
          ref={leftPaneRef}
          className="flex-1 min-w-0 overflow-auto"
          onScroll={syncScrollLeft}
        >
          <Table density="compact" className="border-separate border-spacing-0 w-max">
            <TableHeader>
              {/* Blank group header row — keeps header height equal to the right
                  pane's group + column rows so body rows stay aligned. */}
              <TableHeaderRow className="h-[37px]">
                <TableHeaderGroup
                  colSpan={itemCols.length}
                  className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200"
                  style={{ height: 37 }}
                />
              </TableHeaderRow>
              <TableHeaderRow className="h-[37px]">
                {itemCols.map((c) => (
                  <TableHeaderCell
                    key={c.id}
                    align={c.align}
                    sortable={c.sortable}
                    sortDirection={sort?.id === c.id ? sort.dir : null}
                    onSort={c.sortable ? () => toggleSort(c.id) : undefined}
                    className="bg-gray-50 z-10 sticky border-b-2 border-gray-200 whitespace-nowrap"
                    style={{ width: c.width, minWidth: c.width, top: 37 }}
                  >
                    {c.header}
                  </TableHeaderCell>
                ))}
              </TableHeaderRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const selected = isSelected?.(row);
                const override = isOverride?.(row);
                const review = needsReview?.(row);
                return (
                  <TableRow key={rowKey(row)} selected={selected} className="h-12">
                    {itemCols.map((c, i) => {
                      const bg = selected
                        ? "bg-blue-50"
                        : override
                        ? "bg-orange-50/40"
                        : "bg-white";
                      const reviewAccent = review && i === 0 ? "border-l-2 border-l-hyvee-red" : "";
                      return (
                        <TableCell
                          key={c.id}
                          align={c.align}
                          truncate={false}
                          className={`${bg} border-b border-gray-100 ${reviewAccent}`}
                          style={{ width: c.width, minWidth: c.width }}
                        >
                          {c.cell(row)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Right pane — pricing + impact columns, fixed width */}
        <div
          ref={rightPaneRef}
          className={`flex-shrink-0 overflow-auto ${firstPinnedShadow}`}
          style={{ width: rightWidth }}
          onScroll={syncScrollRight}
        >
          <Table density="compact" className="border-separate border-spacing-0 w-max">
            <TableHeader>
              {/* Group header row — one cell per (group, subgroup) segment */}
              <TableHeaderRow className="h-[37px]">
                {segments.map((seg, i) => (
                  <TableHeaderGroup
                    key={seg.key}
                    colSpan={seg.cols.length}
                    className={`${GROUP_HEADER_BG[seg.group]} sticky top-0 z-20 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide px-3 py-2 ${
                      seg.group === "impact" ? "text-brand" : "text-gray-600"
                    } ${i > 0 ? "border-l border-gray-200" : ""}`}
                    style={{ width: seg.width, minWidth: seg.width }}
                  >
                    {seg.label}
                  </TableHeaderGroup>
                ))}
              </TableHeaderRow>
              {/* Column header row */}
              <TableHeaderRow className="h-[37px]">
                {rightCols.map((c) => (
                  <TableHeaderCell
                    key={c.id}
                    align={c.align}
                    sortable={c.sortable}
                    sortDirection={sort?.id === c.id ? sort.dir : null}
                    onSort={c.sortable ? () => toggleSort(c.id) : undefined}
                    className={`${GROUP_HEADER_BG[c.group]} ${segDivider(c.id)} z-10 sticky border-b-2 border-gray-200 whitespace-nowrap`}
                    style={{ width: c.width, minWidth: c.width, top: 37 }}
                  >
                    {c.header}
                  </TableHeaderCell>
                ))}
              </TableHeaderRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const selected = isSelected?.(row);
                return (
                  <TableRow key={rowKey(row)} selected={selected} className="h-12">
                    {rightCols.map((c) => (
                      <TableCell
                        key={c.id}
                        align={c.align}
                        truncate={false}
                        className={`${GROUP_BG[c.group]} ${segDivider(c.id)} border-b border-gray-100`}
                        style={{ width: c.width, minWidth: c.width }}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // ── Default single-table render path ────────────────────────────────────────

  // Precompute right-offsets for pinned columns (pricing + impact), right→left.
  const pinnedRightOffset = useMemo(() => {
    const offsets: Record<string, number> = {};
    let acc = 0;
    for (let i = columns.length - 1; i >= 0; i--) {
      const c = columns[i];
      if (c.group === "pricing" || c.group === "impact") {
        offsets[c.id] = acc;
        acc += c.width;
      }
    }
    return offsets;
  }, [columns]);

  const isPinned = (g: ColumnGroup) => !flat && (g === "pricing" || g === "impact");
  const firstPinnedId = useMemo(() => columns.find((c) => isPinned(c.group))?.id, [columns]);

  const itemCount = columns.filter((c) => c.group === "item").length;
  const pinnedCols = columns.filter((c) => isPinned(c.group));
  const hasGroups = pinnedCols.length > 0;
  const segments = segmentColumns(pinnedCols, pricingGroupLabel);
  const segmentStartIds = new Set(segments.slice(1).map((s) => s.cols[0].id));
  const segDivider = (id: string) => (segmentStartIds.has(id) ? "border-l border-gray-200" : "");
  // Sticky-right offsets per segment, accumulated right→left.
  const segmentOffsets = (() => {
    const offs: number[] = segments.map(() => 0);
    let acc = 0;
    for (let i = segments.length - 1; i >= 0; i--) {
      offs[i] = acc;
      acc += segments[i].width;
    }
    return offs;
  })();

  const stickyStyle = (c: DataColumn<T>): React.CSSProperties =>
    isPinned(c.group) ? { position: "sticky", right: pinnedRightOffset[c.id], zIndex: 1 } : {};

  const firstPinnedShadow = "shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.08)]";
  const colHeaderTop = hasGroups ? 37 : 0;

  return (
    <div className="h-full overflow-auto border border-gray-200 rounded-xl bg-white">
      {/* w-full fills the container on wide screens; min-w-max preserves the
          intrinsic column widths (and horizontal scroll) when they overflow. */}
      <Table density="compact" className="border-separate border-spacing-0 w-full min-w-max">
        <TableHeader>
          {/* Group header row — only when pricing/impact groups exist */}
          {hasGroups && (
            <TableHeaderRow>
              <TableHeaderGroup
                colSpan={itemCount}
                className="bg-gray-50 sticky top-0 z-20 border-b border-gray-200"
              />
              {segments.map((seg, i) => (
                <TableHeaderGroup
                  key={seg.key}
                  colSpan={seg.cols.length}
                  className={`${GROUP_HEADER_BG[seg.group]} ${
                    i === 0 ? firstPinnedShadow : "border-l border-gray-200"
                  } sticky top-0 z-30 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide px-3 py-2 ${
                    seg.group === "impact" ? "text-brand" : "text-gray-600"
                  }`}
                  style={{ position: "sticky", right: segmentOffsets[i] }}
                >
                  {seg.label}
                </TableHeaderGroup>
              ))}
            </TableHeaderRow>
          )}

          {/* Column header row */}
          <TableHeaderRow>
            {columns.map((c) => {
              const pinned = isPinned(c.group);
              return (
                <TableHeaderCell
                  key={c.id}
                  align={c.align}
                  sortable={c.sortable}
                  sortDirection={sort?.id === c.id ? sort.dir : null}
                  onSort={c.sortable ? () => toggleSort(c.id) : undefined}
                  className={`${pinned ? GROUP_HEADER_BG[c.group] : "bg-gray-50"} ${
                    c.id === firstPinnedId ? firstPinnedShadow : segDivider(c.id)
                  } ${pinned ? "z-20" : "z-10"} sticky border-b-2 border-gray-200 whitespace-nowrap`}
                  style={{ ...stickyStyle(c), width: c.width, minWidth: c.width, top: colHeaderTop }}
                >
                  {c.header}
                </TableHeaderCell>
              );
            })}
          </TableHeaderRow>
        </TableHeader>

        <TableBody>
          {sortedRows.map((row) => {
            const selected = isSelected?.(row);
            const override = isOverride?.(row);
            const review = needsReview?.(row);
            return (
              <TableRow
                key={rowKey(row)}
                selected={selected}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        // Only act on the row itself — let inner controls
                        // (the select checkbox) handle their own keys.
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={
                  onRowClick
                    ? "cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    : undefined
                }
              >
                {columns.map((c, i) => {
                  const pinned = isPinned(c.group);
                  // Review rows stay WHITE with a Hy-Vee red left rail (the HQ color)
                  // on the first cell — so undecided HQ items read as "act on me"
                  // without the gray wash, and amber stays for promos.
                  const bg = pinned
                    ? GROUP_BG[c.group]
                    : selected
                    ? "bg-blue-50"
                    : override
                    ? "bg-orange-50/40"
                    : "bg-white";
                  // Accent goes LAST so tailwind-merge keeps the red left border
                  // (a trailing `border-gray-100` would otherwise win the merge).
                  const reviewAccent = review && i === 0 ? "border-l-2 border-l-hyvee-red" : "";
                  return (
                    <TableCell
                      key={c.id}
                      align={c.align}
                      truncate={false}
                      className={`${bg} ${
                        c.id === firstPinnedId ? firstPinnedShadow : segDivider(c.id)
                      } border-b border-gray-100 ${reviewAccent}`}
                      style={{ ...stickyStyle(c), width: c.width, minWidth: c.width }}
                    >
                      {c.cell(row)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
