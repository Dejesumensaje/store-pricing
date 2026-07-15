"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Tag } from "lucide-react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { BottomSheet } from "./BottomSheet";
import { isoAddDays } from "@/lib/mobile";

// ─── Meta chips ──────────────────────────────────────────────────────────
// Dates and reasons are attributes OF A CHANGE, not of the item — so they
// render as a compact chip row inside the section card they describe, only
// once that section has a change. The chip is both display and edit
// affordance (tap → bottom sheet). Defaults (today / one-week window) are
// prefilled so a Store Walk never blocks on them.

export function MetaChip({
  icon: Icon,
  label,
  onClick,
  ariaLabel,
  empty,
}: {
  icon: typeof CalendarDays;
  label: string;
  onClick: () => void;
  ariaLabel: string;
  empty?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex h-10 min-w-0 select-none touch-manipulation items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium active:bg-gray-100 ${
        empty ? "border-dashed border-gray-400 bg-white/70 text-gray-600" : "border-gray-300 bg-white text-gray-800"
      }`}
    >
      <Icon className={`size-3.5 shrink-0 ${empty ? "text-gray-400" : "text-gray-500"}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export const ReasonIcon = Tag;
export const DateIcon = CalendarDays;

// ─── Reason sheet ────────────────────────────────────────────────────────
// One-tap list reusing the desktop reason catalogs verbatim, including their
// group headers ("Deals & programs" / "Inventory") so the vocabulary is
// identical across surfaces.

export type ReasonOption = { value: string; label: string; category?: string };

export function ReasonSheet({
  open,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: ReasonOption[];
  value: string | undefined;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const groups = [...new Set(options.map((o) => o.category))];
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1">
        {groups.map((group) => (
          <div key={group ?? "all"}>
            {group && (
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</p>
            )}
            <ul className="flex flex-col gap-1">
              {options
                .filter((o) => o.category === group)
                .map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(o.value);
                        onClose();
                      }}
                      className="flex min-h-12 w-full select-none touch-manipulation items-center justify-between rounded-lg px-3 py-3 text-left text-base font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100"
                    >
                      {o.label}
                      {o.value === value && <Check className="size-4 text-brand" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// ─── Effective-date sheet ────────────────────────────────────────────────
// Native date inputs (= the Android system calendar on the Zebra) prefilled
// with the current values, plus quick presets for the common cases. `single`
// = Base's one effective date; `range` = Retail/Fuel's run window.

export function EffectiveSheet({
  open,
  title,
  mode,
  start,
  end,
  onApply,
  onClose,
}: {
  open: boolean;
  title: string;
  mode: "single" | "range";
  start: string;
  end?: string | null;
  onApply: (start: string, end: string | null) => void;
  onClose: () => void;
}) {
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end ?? null);
  useEffect(() => {
    if (open) {
      setDraftStart(start);
      setDraftEnd(end ?? null);
    }
  }, [open, start, end]);

  const apply = (s: string, e: string | null) => {
    onApply(s, mode === "range" ? e : null);
    onClose();
  };

  const preset = (label: string, s: string, e: string | null) => (
    <button
      type="button"
      key={label}
      onClick={() => apply(s, e)}
      className="h-11 select-none touch-manipulation rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 active:bg-gray-100"
    >
      {label}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 p-2">
        <div className="flex flex-wrap gap-2">
          {mode === "single"
            ? [
                preset("Today", start, null),
                preset("Tomorrow", isoAddDays(start, 1), null),
                preset("In a week", isoAddDays(start, 7), null),
              ]
            : [
                preset("1 week", draftStart, isoAddDays(draftStart, 6)),
                preset("2 weeks", draftStart, isoAddDays(draftStart, 13)),
              ]}
        </div>
        <div className="flex items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
            {mode === "range" ? "Starts" : "Effective"}
            <input
              type="date"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="h-12 rounded-lg border border-gray-300 px-3 text-base text-gray-900"
            />
          </label>
          {mode === "range" && (
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
              Ends
              <input
                type="date"
                value={draftEnd ?? ""}
                onChange={(e) => setDraftEnd(e.target.value || null)}
                className="h-12 rounded-lg border border-gray-300 px-3 text-base text-gray-900"
              />
            </label>
          )}
        </div>
        <Button variant="primary" className="h-12 w-full" onClick={() => apply(draftStart, draftEnd)}>
          Apply
        </Button>
      </div>
    </BottomSheet>
  );
}
