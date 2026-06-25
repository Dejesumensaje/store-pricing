"use client";

type Props = {
  /** Time as HH:mm (24h, empty/null = no time). */
  value?: string | null;
  onChange: (value: string | null) => void;
  "aria-label": string;
  className?: string;
};

/**
 * Native time input — sibling to DateField. The DS controls render popovers that
 * the Modal/Drawer focus-trap swallows, so a native input is used inside overlays.
 * Batch scheduling pairs this with DateField to capture date + time.
 */
export function TimeField({ value, onChange, className, ...rest }: Props) {
  return (
    <input
      type="time"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand ${className ?? ""}`}
      {...rest}
    />
  );
}

/** A sensible default send time (early morning, before store open). */
export const DEFAULT_SEND_TIME = "06:00";
