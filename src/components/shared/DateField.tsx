"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

/**
 * A single-date field: an input that opens a ONE-month calendar popover and
 * closes on the first pick. Sibling to DateRangeField (Retail / Fuel Saver's
 * two-endpoint promo period) — this is the single-endpoint case, for Base
 * Price's Effective Date, which has no end to collect (see baseEffectiveDate).
 *
 * Same inline-popover constraint as DateRangeField applies: rendered locally,
 * NOT in a portal — the DS DatePicker's Radix PopoverPortal gets swallowed by
 * the Drawer focus-trap.
 *
 * Values are the store's YYYY-MM-DD strings; Date conversion stays local here.
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parse(s?: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function shortLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  /** Selected date, YYYY-MM-DD. */
  value?: string | null;
  onChange: (date: string | null) => void;
  /** Earliest selectable day, YYYY-MM-DD. Defaults to today. */
  min?: string;
  /** Red invalid styling (e.g. required-but-empty). Also sets aria-invalid. */
  error?: boolean;
  "aria-label"?: string;
  /** Id of the helper/error text describing this field, for screen readers. */
  "aria-describedby"?: string;
};

export function DateField({ value, onChange, min, error, ...rest }: Props) {
  const selected = parse(value);
  const today = startOfDay(new Date());
  const minDate = parse(min) ?? today;

  const [open, setOpen] = useState(false);
  // Flip the panel above the trigger when there isn't room below (the drawer's
  // bottom sections would otherwise clip a downward calendar).
  const [openUp, setOpenUp] = useState(false);
  const [view, setView] = useState<Date>(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (no portal, so a simple document listener).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    // Escape dismisses only THIS popover, not the enclosing Drawer. The DS
    // Drawer (Radix) closes on a capture-phase document Escape listener, so we
    // intercept one level earlier — window capture precedes document capture —
    // and stop the event before it reaches the Drawer.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open]);

  function pick(day: Date) {
    if (day < minDate) return;
    onChange(iso(day));
    setOpen(false);
  }

  const atMin = view.getFullYear() === minDate.getFullYear() && view.getMonth() === minDate.getMonth();

  function monthGrid(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="grid w-[196px] grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-[11px] font-medium text-gray-400">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`b${i}`} />;
          const disabled = day < minDate;
          const isSelected = selected != null && sameDay(day, selected);
          const isToday = sameDay(day, today);
          return (
            <div key={iso(day)} className="flex h-8 items-center justify-center">
              <button
                type="button"
                // Selected day stays interactive even if in the past (you can
                // re-pick), but plain past days are not selectable.
                disabled={disabled && !isSelected}
                onClick={() => pick(day)}
                aria-pressed={isSelected}
                // Full date, not just the bare day number — a SR user tabbing
                // the grid needs "Thursday, July 15", not "15".
                aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                className={`flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums ${
                  isSelected
                    ? "bg-brand font-semibold text-white"
                    : disabled
                    ? "cursor-default text-gray-300"
                    : "text-gray-700 hover:bg-gray-100"
                } ${!isSelected && isToday ? "ring-1 ring-brand/40" : ""}`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  const label = selected ? shortLabel(selected) : "Select date";

  return (
    <div ref={rootRef} className="relative">
      {/* aria-invalid announces the error state, not just paints it red —
          paired with aria-describedby pointing at the visible helper text so
          SRs also hear the "why". jsx-a11y flags aria-invalid on a button per
          strict ARIA role mapping, but SRs announce it on focusable popup
          triggers in practice — worth the exception. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        type="button"
        onClick={() => {
          if (!open && rootRef.current) {
            const rect = rootRef.current.getBoundingClientRect();
            setOpenUp(window.innerHeight - rect.bottom < 300);
          }
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        aria-invalid={error || undefined}
        aria-describedby={rest["aria-describedby"]}
        className={`flex w-full items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-left text-sm ${
          error ? "border-red-300 ring-1 ring-red-200" : "border-gray-300"
        } ${selected ? "text-gray-900" : "text-gray-400"}`}
      >
        <Calendar className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="flex-1">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date"
          className={`absolute left-0 z-50 rounded-lg border border-gray-200 bg-white p-2 shadow-lg ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="mb-1 flex w-[196px] items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={atMin}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {monthGrid(view)}
        </div>
      )}
    </div>
  );
}
