"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { ChevronDown, Check, Plus, Layers } from "lucide-react";
import { Batch } from "@/types/pricing";
import { useMenuNav } from "../shared/useMenuNav";

type Props = {
  /** The batch the user is currently building into (one-click target). */
  activeBatch?: Batch | null;
  /** Open batches the menu can target (draft + scheduled). */
  openBatches: Batch[];
  /** Add to the active batch (primary click when an active batch exists). */
  onAddToActive: () => void;
  /** Add to a specific batch AND make it the active one. */
  onAddToBatch: (batchId: string) => void;
  /** Start the New batch flow (seeded by the caller). */
  onNewBatch: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
};

// Split button: one click adds to the active batch; the caret opens a menu to
// switch the target batch or create a new one. DS has no dropdown, so this uses
// the same headless open/click-outside/Escape pattern as ColumnsMenu.
export function BatchSplitButton({
  activeBatch,
  openBatches,
  onAddToActive,
  onAddToBatch,
  onNewBatch,
  disabled,
  size = "md",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useMenuNav(open, () => setOpen(false), ref, panelRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const hasActive = activeBatch != null;
  const mainLabel = hasActive ? `Add to “${truncate(activeBatch!.name)}”` : "Add to batch";

  return (
    <div className="relative inline-flex min-w-0 items-center gap-1" ref={ref}>
      <Button
        variant="primary"
        size={size}
        iconLeft={Layers}
        disabled={disabled}
        className="min-w-0"
        onClick={() => (hasActive ? onAddToActive() : setOpen((o) => !o))}
      >
        <span className="block truncate">{mainLabel}</span>
      </Button>
      <Button
        variant="primary"
        size={size}
        iconLeft={ChevronDown}
        aria-label="Choose batch"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className="shrink-0"
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Choose batch"
          onKeyDown={onKeyDown}
          className="absolute bottom-full right-0 z-50 mb-1.5 w-64 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
        >
          {openBatches.length > 0 && (
            <>
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Add to batch</p>
              {openBatches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAddToBatch(b.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
                >
                  <span className="truncate">{b.name}</span>
                  {activeBatch?.id === b.id && <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                </button>
              ))}
              <div className="my-1 border-t border-gray-100" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNewBatch();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
          >
            <Plus className="size-4" aria-hidden="true" /> New batch…
          </button>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, max = 16) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
