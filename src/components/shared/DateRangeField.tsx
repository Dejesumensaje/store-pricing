"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

/**
 * A range date field: an input that opens a TWO-month calendar popover (Google
 * Flights pattern), so a range can span a month boundary (e.g. Jun 25 → Jul 14)
 * without hunting one month at a time. Days before `min` (default today) are
 * disabled; navigation forward is unrestricted.
 *
 * The popover is rendered INLINE (absolutely positioned within this component),
 * NOT in a portal — the DS DatePicker's Radix PopoverPortal gets swallowed by the
 * Drawer focus-trap, so we stay in the local DOM.
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
  /** Range start, YYYY-MM-DD. */
  start?: string | null;
  /** Range end, YYYY-MM-DD. */
  end?: string | null;
  onChange: (start: string | null, end: string | null) => void;
  /** Earliest selectable day, YYYY-MM-DD. Defaults to today. */
  min?: string;
  /** Red invalid styling (e.g. required-but-empty). Also sets aria-invalid. */
  error?: boolean;
  "aria-label"?: string;
  /** Id of the helper/error text describing this field, for screen readers. */
  "aria-describedby"?: string;
};

export function DateRangeField({ start, end, onChange, min, error, ...rest }: Props) {
  const from = parse(start);
  const to = parse(end);
  const today = startOfDay(new Date());
  const minDate = parse(min) ?? today;

  const [open, setOpen] = useState(false);
  // Flip the panel above the trigger when there isn't room below (the drawer's
  // bottom sections would otherwise clip a downward calendar).
  const [openUp, setOpenUp] = useState(false);
  // The day under the cursor while picking an end date — drives the live range
  // preview band (Google Flights style).
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [view, setView] = useState<Date>(() => {
    const base = from ?? new Date();
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
    // Fresh start when nothing picked, a full range exists, or the click is
    // before the current start; otherwise this completes the range.
    if (!from || (from && to) || day < from) {
      onChange(iso(day), null);
    } else {
      onChange(iso(from), iso(day));
      setHoverDate(null);
      setOpen(false);
    }
  }

  const leftAtMin =
    view.getFullYear() === minDate.getFullYear() && view.getMonth() === minDate.getMonth();
  const rightView = new Date(view.getFullYear(), view.getMonth() + 1, 1);

  // While picking the end (start chosen, end not), the band previews to the hovered
  // day; otherwise it spans the committed range.
  const selecting = from != null && to == null;
  const bandEnd =
    to ?? (selecting && hoverDate != null && hoverDate >= from! ? hoverDate : null);
  const showBand = from != null && bandEnd != null;

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
          const isFrom = from != null && sameDay(day, from);
          const isTo = bandEnd != null && sameDay(day, bandEnd);
          const isEndpoint = isFrom || isTo;
          const inBand = showBand && day >= from! && day <= bandEnd!;
          const isToday = sameDay(day, today);
          // Continuous band: full-height cell bg, rounded only at the true ends.
          const band = inBand
            ? `bg-brand/10 ${isFrom ? "rounded-l-full" : ""} ${isTo ? "rounded-r-full" : ""}`
            : "";
          return (
            <div key={iso(day)} className={`flex h-8 items-center justify-center ${band}`}>
              <button
                type="button"
                // Endpoints stay interactive even if in the past (you can re-pick a
                // new start), but plain past days are not selectable.
                disabled={disabled && !isEndpoint}
                onClick={() => pick(day)}
                onMouseEnter={() => !disabled && setHoverDate(day)}
                aria-pressed={isEndpoint}
                // Full date, not just the bare day number — a SR user tabbing
                // the grid needs "Thursday, July 15", not "15".
                aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                className={`flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums ${
                  // Endpoint styling wins over "past/disabled" so an already-running
                  // promo's start reads as a filled endpoint, not a greyed day.
                  isEndpoint
                    ? "bg-brand font-semibold text-white"
                    : disabled
                    ? "cursor-default text-gray-300"
                    : "text-gray-700 hover:bg-gray-100"
                } ${!isEndpoint && isToday ? "ring-1 ring-brand/40" : ""}`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  const label = from
    ? to
      ? `${shortLabel(from)} – ${shortLabel(to)}`
      : `${shortLabel(from)} – …`
    : "Select dates";

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
            setOpenUp(window.innerHeight - rect.bottom < 340);
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
        } ${from ? "text-gray-900" : "text-gray-400"}`}
      >
        <Calendar className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="flex-1">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className={`absolute left-0 z-50 rounded-lg border border-gray-200 bg-white p-2 shadow-lg max-md:right-0 max-md:shadow-xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {/* Mobile: single-month header with full prev/next navigation */}
          <div className="mb-1 flex items-center justify-between md:hidden">
            <button
              type="button"
              aria-label="Previous month"
              disabled={leftAtMin}
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

          {/* Desktop: two-month header */}
          <div className="mb-1 hidden items-center gap-3 md:flex">
            <div className="flex w-[196px] items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={leftAtMin}
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                className="flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold text-gray-700">
                {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <span className="size-7" aria-hidden="true" />
            </div>
            <div className="flex w-[196px] items-center justify-between">
              <span className="size-7" aria-hidden="true" />
              <span className="text-sm font-semibold text-gray-700">
                {rightView.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
          </div>

          {/* Mobile: popover spans the field width (max-md:right-0 above) so it
              reads as its own layer instead of colliding with siblings; the
              single month grid centers in that width. */}
          <div className="flex gap-3 max-md:justify-center" onMouseLeave={() => setHoverDate(null)}>
            {monthGrid(view)}
            {/* Second month only on desktop — too wide for mobile drawer */}
            <div className="hidden md:block">{monthGrid(rightView)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
