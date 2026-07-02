"use client";

import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";

// Collapsed-by-default context panel. Keeps supporting info (competitors,
// product relationships, projected impact) available without pushing the price
// decision down — the decision stays above the fold, context is one click away.
export function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const panelId = useId();
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">
          {title}
          {count != null && <span className="ml-1 font-normal text-gray-400">({count})</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-gray-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-gray-100 px-4 py-3 text-gray-600">
        {children}
      </div>
    </div>
  );
}
