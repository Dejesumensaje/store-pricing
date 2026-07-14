"use client";

type Props = {
  /** Date as YYYY-MM-DD (empty/null = no date). */
  value?: string | null;
  onChange: (value: string | null) => void;
  /** Earliest selectable date as YYYY-MM-DD. */
  min?: string;
  /** Red invalid styling (e.g. required-but-empty). */
  error?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
  className?: string;
};

/**
 * Native date input. The DS DatePicker renders its calendar in a portal/popover
 * whose clicks get swallowed by the Modal/Drawer focus-trap, so it can't be used
 * inside overlays — this works everywhere.
 */
export function DateField({ value, onChange, min, error, className, ...rest }: Props) {
  return (
    <input
      type="date"
      value={value ?? ""}
      min={min}
      aria-invalid={error || undefined}
      onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-md border bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand ${
        error ? "border-red-300 ring-1 ring-red-200" : "border-gray-300"
      } ${className ?? ""}`}
      {...rest}
    />
  );
}

/** Today as YYYY-MM-DD (for `min`). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
