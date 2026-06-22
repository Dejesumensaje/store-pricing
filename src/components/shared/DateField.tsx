"use client";

type Props = {
  /** Date as YYYY-MM-DD (empty/null = no date). */
  value?: string | null;
  onChange: (value: string | null) => void;
  /** Earliest selectable date as YYYY-MM-DD. */
  min?: string;
  "aria-label": string;
  className?: string;
};

/**
 * Native date input. The DS DatePicker renders its calendar in a portal/popover
 * whose clicks get swallowed by the Modal/Drawer focus-trap, so it can't be used
 * inside overlays — this works everywhere.
 */
export function DateField({ value, onChange, min, className, ...rest }: Props) {
  return (
    <input
      type="date"
      value={value ?? ""}
      min={min}
      onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand ${className ?? ""}`}
      {...rest}
    />
  );
}

/** Today as YYYY-MM-DD (for `min`). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
