"use client";

import { useEffect, useState } from "react";
import { Drawer, Button, Checkbox, Badge } from "@dejesumensaje/converge-ds-experimental";

export type FilterFacet = { key: string; label: string; options: string[] };
/** Selected option values keyed by facet key. */
export type FilterValue = Record<string, string[]>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facets: FilterFacet[];
  value: FilterValue;
  onApply: (value: FilterValue) => void;
};

function toggle(list: string[], option: string, checked: boolean | "indeterminate"): string[] {
  if (checked === true) return list.includes(option) ? list : [...list, option];
  return list.filter((o) => o !== option);
}

function countSelected(value: FilterValue): number {
  return Object.values(value).reduce((n, opts) => n + opts.length, 0);
}

// Reusable faceted filter drawer. Holds a draft until the user applies, so
// partial selections don't thrash the underlying list.
export function FilterDrawer({ open, onOpenChange, facets, value, onApply }: Props) {
  const [draft, setDraft] = useState<FilterValue>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const total = countSelected(draft);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      size="sm"
      headerActions={total > 0 ? <Badge tone="in-progress" size="sm">{total}</Badge> : undefined}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="tertiary" onClick={() => setDraft({})}>
            Clear all
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
      <div className="flex flex-col gap-5">
        {facets.map((facet) => {
          const selected = draft[facet.key] ?? [];
          return (
            <div key={facet.key}>
              <p className="mb-2 text-sm font-semibold text-gray-700">{facet.label}</p>
              <div className="flex flex-col gap-1.5">
                {facet.options.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selected.includes(option)}
                      onCheckedChange={(c) =>
                        setDraft((prev) => ({ ...prev, [facet.key]: toggle(prev[facet.key] ?? [], option, c) }))
                      }
                      aria-label={`${facet.label}: ${option}`}
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
