"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { ChevronDown, Check, Store as StoreIcon } from "lucide-react";
import { usePricingStore, useActiveStore, useStoreSummaries } from "@/store/pricing-store";
import { useMenuNav } from "@/components/shared/useMenuNav";

// The store name at the top of the page doubles as a store switcher. A director
// runs ~5 stores; this lets them jump between them without losing unsent work in
// each. Each entry shows how much work is waiting there (unsent changes + HQ recs).
// The DS has no Popover/DropdownMenu yet, so this mirrors ColumnsMenu's headless
// popover (click-outside + useMenuNav for focus/arrow/Escape).
export function StoreSwitcher() {
  const active = useActiveStore();
  const activeStoreId = usePricingStore((s) => s.activeStoreId);
  const setActiveStore = usePricingStore((s) => s.setActiveStore);
  const summaries = useStoreSummaries();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const { onKeyDown } = useMenuNav(open, () => setOpen(false), ref, panelRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative order-1" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${active.name} — switch store`}
        onClick={() => setOpen((o) => !o)}
        className="-ml-1 flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-100"
      >
        <span className="text-2xl font-bold text-gray-900">{active.name}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-5 text-gray-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-labelledby={labelId}
          onKeyDown={onKeyDown}
          className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
        >
          <p id={labelId} className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Your stores
          </p>
          {summaries.map(({ store, unsent, hqCount }) => {
            const isActive = store.id === activeStoreId;
            return (
              <button
                key={store.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setActiveStore(store.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50 ${
                  isActive ? "bg-brand/5" : ""
                }`}
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {isActive ? (
                    <Check className="size-4 text-brand" aria-hidden="true" />
                  ) : (
                    <StoreIcon className="size-4 text-gray-300" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${isActive ? "text-brand" : "text-gray-900"}`}>
                    {store.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{store.address}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {unsent > 0 && (
                      <Badge tone="in-progress" size="sm">
                        {unsent} unsent
                      </Badge>
                    )}
                    {hqCount > 0 && (
                      <Badge tone="warning" size="sm">
                        {hqCount} HQ
                      </Badge>
                    )}
                    {unsent === 0 && hqCount === 0 && (
                      <span className="text-xs text-gray-400">No pending work</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
