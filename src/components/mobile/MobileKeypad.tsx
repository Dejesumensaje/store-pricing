"use client";

import { Delete } from "lucide-react";

type Props = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// One class string for every key so press feedback is identical across the
// grid. `touch-manipulation` removes the mobile double-tap-zoom gesture (and
// its tap delay) — essential for rapid repeated tapping; `select-none` stops
// a long-press from selecting the digit glyph; the pressed state darkens AND
// shrinks slightly so a hit registers even with the thumb covering the key.
const KEY =
  "h-14 rounded-xl bg-gray-100 text-xl font-semibold text-gray-900 select-none touch-manipulation " +
  "transition-transform duration-75 motion-reduce:transition-none active:bg-gray-300 active:scale-95 " +
  "disabled:opacity-40 sm:h-16";

// Big cents-entry keypad — 3x4 grid, thumb-zone sized (56-64px keys). Digits
// shift the active price field's buffer left-to-right like a calculator
// (2, 9, 9 → $2.99); there's no decimal key because there's no decimal to
// enter. Which field the digits land in is signalled by the caret + brand
// border + tinted label on the target price box.
export function MobileKeypad({ onDigit, onBackspace, disabled }: Props) {
  return (
    <div role="group" aria-label="Price keypad" className="grid grid-cols-3 gap-2 px-3 pt-2">
      {DIGIT_KEYS.map((k) => (
        <button key={k} type="button" disabled={disabled} onClick={() => onDigit(k)} className={KEY}>
          {k}
        </button>
      ))}
      <span aria-hidden="true" />
      <button type="button" disabled={disabled} onClick={() => onDigit("0")} className={KEY}>
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Backspace"
        className={`${KEY} flex items-center justify-center text-gray-600`}
      >
        <Delete className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
