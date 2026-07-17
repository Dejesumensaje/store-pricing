"use client";

import { ArrowDown, ArrowUp, Check, RotateCcw, Sparkles } from "lucide-react";

export type HqRecStatus =
  | "pending" // no decision yet — full block, Accept is primary
  | "accepted" // the draft equals the rec — collapsed provenance line + Undo
  | "typing" // the director is entering their own price — rec stays reachable
  | "kept"; // "Keep current" staged — collapsed line + Undo

type Props = {
  status: HqRecStatus;
  /** Live value label, e.g. "$3.49" / "None". */
  currentLabel: string;
  /** Recommended value label, e.g. "$3.19" / "$0.10". */
  recLabel: string;
  /** True when the rec moves the value down (drives the arrow direction). */
  down: boolean;
  /** "save 30¢" — only for price drops where it means something. */
  saveNote?: string | null;
  /** HQ's own reason label ("Cost change") — the block always shows why. */
  reasonLabel?: string | null;
  onAccept: () => void;
  onKeep: () => void;
  onUndo: () => void;
};

const HQ_PILL =
  "inline-flex items-center gap-0.5 rounded-sm bg-hyvee-red px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white";

// An HQ recommendation, rendered under the price row it belongs to. Renders
// ONLY while the section actually carries a pending rec — most items never
// show it. Red is HQ's color across the product (ADR-0045/46); this block is
// deliberately the only red element on a calm screen, so it draws the eye
// without shouting. The proposal never disappears once the director engages
// (ADR-0047 — inputs are permanent): every state keeps a one-tap way back.
export function HqRecBlock({ status, currentLabel, recLabel, down, saveNote, reasonLabel, onAccept, onKeep, onUndo }: Props) {
  const Arrow = down ? ArrowDown : ArrowUp;

  if (status === "accepted") {
    return (
      <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-red-50/60 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <span className={HQ_PILL}>HQ</span>
          <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
          Accepted {recLabel}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 px-1.5 text-xs font-semibold text-brand active:opacity-70"
        >
          <RotateCcw className="size-3.5 text-brand/70" aria-hidden="true" />
          Undo
        </button>
      </div>
    );
  }

  if (status === "kept") {
    return (
      <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <span className={HQ_PILL}>HQ</span>
          Keeping current — rec declined
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 px-1.5 text-xs font-semibold text-brand active:opacity-70"
        >
          <RotateCcw className="size-3.5 text-brand/70" aria-hidden="true" />
          Undo
        </button>
      </div>
    );
  }

  if (status === "typing") {
    // The director is pricing it themselves — the proposal collapses but
    // stays one tap away. Typing IS the override; no mode, no dialog.
    return (
      <button
        type="button"
        onClick={onAccept}
        className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 self-start rounded-lg bg-red-50/60 px-2.5 py-1.5 text-xs font-medium text-gray-700 active:bg-red-100"
      >
        <span className={HQ_PILL}>HQ</span>
        proposed {recLabel}
        <span className="font-semibold text-brand">Use</span>
      </button>
    );
  }

  // pending — the full current ↓ recommended block.
  return (
    <div className="rise-in flex flex-col gap-1.5 rounded-lg border border-red-100 bg-red-50/60 p-2.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
        <span className={`${HQ_PILL} hq-pulse`}>
          <Sparkles className="size-2.5" aria-hidden="true" />
          HQ
        </span>
        recommends
        {reasonLabel && <span className="font-normal text-gray-500">· {reasonLabel}</span>}
      </span>
      <div className="flex flex-col pl-0.5 tabular-nums">
        <span className="text-sm text-gray-500">{currentLabel} current</span>
        <span className="flex items-center gap-1.5">
          <Arrow className="size-3.5 text-hyvee-red" aria-hidden="true" />
          <span className="text-base font-bold text-gray-900">{recLabel}</span>
          {saveNote && <span className="text-xs font-medium text-gray-500">{saveNote}</span>}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {/* Accept is the lightweight, satisfying path: one tap, no dialog —
            the value pours into the price row and Undo replaces confirmation. */}
        <button
          type="button"
          onClick={onAccept}
          className="min-h-10 select-none touch-manipulation rounded-lg bg-hyvee-red px-3.5 text-sm font-semibold text-white transition-transform duration-75 active:scale-[0.97] motion-reduce:transition-none"
        >
          Accept {recLabel}
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="min-h-10 select-none touch-manipulation rounded-lg px-2 text-sm font-medium text-gray-500 active:bg-gray-100"
        >
          Keep current
        </button>
      </div>
    </div>
  );
}
