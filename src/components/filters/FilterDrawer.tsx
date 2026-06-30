"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer, Button, Checkbox, Badge, Input } from "@dejesumensaje/converge-ds-experimental";
import { ChevronDown, Search } from "lucide-react";

export type FilterFacet = {
  key: string;
  label: string;
  options: string[];
  /** Force the search box on even for short lists (otherwise it appears past SEARCH_THRESHOLD). */
  searchable?: boolean;
};
/** Selected option values keyed by facet key. */
export type FilterValue = Record<string, string[]>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facets: FilterFacet[];
  value: FilterValue;
  onApply: (value: FilterValue) => void;
};

// A facet shows its search box past this many options, and collapses long lists
// to VISIBLE_CAP rows (with a "Show all" affordance) so a facet with hundreds of
// values stays usable — you search to narrow instead of scrolling forever.
const SEARCH_THRESHOLD = 8;
const VISIBLE_CAP = 10;

function toggle(list: string[], option: string, checked: boolean | "indeterminate"): string[] {
  if (checked === true) return list.includes(option) ? list : [...list, option];
  return list.filter((o) => o !== option);
}

function countSelected(value: FilterValue): number {
  return Object.values(value).reduce((n, opts) => n + opts.length, 0);
}

// One accordion facet: header (label + selected count + chevron) and, when open,
// a search box, the (selected-first) option list capped to VISIBLE_CAP, and a
// "Show all" toggle. Self-contained so the drawer body stays a simple map.
function FacetSection({
  facet,
  selected,
  open,
  onToggleOpen,
  onChange,
}: {
  facet: FilterFacet;
  selected: string[];
  open: boolean;
  onToggleOpen: () => void;
  onChange: (next: string[]) => void;
}) {
  // Reset to a clean slate each time the drawer opens via remount (see the key in
  // the parent), so no reset-on-close effect is needed.
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const showSearch = facet.searchable || facet.options.length > SEARCH_THRESHOLD;

  // Filter by query, then float selected options to the top so they stay visible.
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? facet.options.filter((o) => o.toLowerCase().includes(q)) : facet.options;
    return [...matches].sort((a, b) => Number(selected.includes(b)) - Number(selected.includes(a)));
  }, [facet.options, query, selected]);

  const visible = showAll ? ordered : ordered.slice(0, VISIBLE_CAP);
  const hidden = ordered.length - visible.length;

  return (
    <div className="py-1.5">
      {/* The WHOLE header row toggles open/closed (not just the chevron). "Clear"
          is a separate button overlaid on the right so it stays its own action. */}
      <div className="relative py-1.5">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${facet.label}`}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold text-gray-700">{facet.label}</span>
          {selected.length > 0 && <Badge tone="in-progress" size="sm">{selected.length}</Badge>}
          <ChevronDown
            aria-hidden
            className={`ml-auto size-4 shrink-0 text-gray-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="absolute right-7 top-1/2 -translate-y-1/2 flex min-h-[44px] items-center text-xs font-medium text-brand hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="pb-1">
          {showSearch && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              iconLeft={Search}
              size="sm"
              aria-label={`Search ${facet.label}`}
              placeholder={`Search ${facet.label.toLowerCase()}`}
              className="mb-2.5 w-full"
            />
          )}
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-gray-400">No matches</p>
            ) : (
              visible.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={(c) => onChange(toggle(selected, option, c))}
                    aria-label={`${facet.label}: ${option}`}
                    size="sm"
                  />
                  <span className="truncate text-sm text-gray-700">{option}</span>
                </label>
              ))
            )}
          </div>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-1.5 px-2 text-xs font-medium text-brand hover:underline"
            >
              Show all ({ordered.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Reusable faceted filter drawer. Holds a draft until the user applies, so
// partial selections don't thrash the underlying list. Facets are accordions
// (collapsed by default, except those with active selections) and each one is
// searchable + capped, so it scales to hundreds of values per facet.
export function FilterDrawer({ open, onOpenChange, facets, value, onApply }: Props) {
  const [draft, setDraft] = useState<FilterValue>(value);
  const [openFacets, setOpenFacets] = useState<Set<string>>(new Set());
  // Capture the trigger element so focus can be restored when the drawer closes.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setDraft(value);
    // Open facets that already have a selection so active filters are visible;
    // otherwise open just the first facet as a starting point.
    const active = facets.filter((f) => (value[f.key]?.length ?? 0) > 0).map((f) => f.key);
    setOpenFacets(new Set(active.length ? active : facets.slice(0, 1).map((f) => f.key)));
    return () => restoreFocusRef.current?.focus();
  }, [open, value, facets]);

  const total = countSelected(draft);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      size="sm"
      className="max-md:!w-full"
      headerActions={total > 0 ? <Badge tone="in-progress" size="sm">{total}</Badge> : undefined}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="tertiary" onClick={() => setDraft({})}>
            Reset filters
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply{total > 0 ? ` (${total})` : ""}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col divide-y divide-gray-100">
        {facets.map((facet) => (
          <FacetSection
            // Include `open` so each facet remounts fresh when the drawer opens.
            key={`${facet.key}-${open}`}
            facet={facet}
            selected={draft[facet.key] ?? []}
            open={openFacets.has(facet.key)}
            onToggleOpen={() =>
              setOpenFacets((prev) => {
                const next = new Set(prev);
                next.has(facet.key) ? next.delete(facet.key) : next.add(facet.key);
                return next;
              })
            }
            onChange={(nextSel) => setDraft((prev) => ({ ...prev, [facet.key]: nextSel }))}
          />
        ))}
      </div>
    </Drawer>
  );
}
