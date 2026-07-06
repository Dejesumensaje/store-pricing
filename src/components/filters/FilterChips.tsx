"use client";

import { Chip } from "@dejesumensaje/converge-ds-experimental";
import { FilterFacet, FilterValue } from "./FilterDrawer";

type Props = {
  facets: FilterFacet[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
};

// One removable chip per selected (facet, value) pair, so a director can see
// and undo a specific filter without reopening the drawer. Mutates `filters`
// directly — FilterDrawer's own draft re-syncs from `value` on every open, so
// this stays consistent whether or not the drawer happens to be open.
export function FilterChips({ facets, value, onChange }: Props) {
  const remove = (key: string, option: string) => {
    onChange({ ...value, [key]: value[key]?.filter((o) => o !== option) ?? [] });
  };

  const chips = facets.flatMap((facet) =>
    (value[facet.key] ?? []).map((option) => ({ facet, option }))
  );

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map(({ facet, option }) => (
        <Chip
          key={`${facet.key}:${option}`}
          size="sm"
          onClose={() => remove(facet.key, option)}
          closeLabel={`Remove ${facet.label}: ${option} filter`}
        >
          {facet.label}: {option}
        </Chip>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs font-medium text-brand hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
