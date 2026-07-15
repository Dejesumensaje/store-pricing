"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PricingItem } from "@/types/pricing";

// Read-only reference info, collapsed by default — Description, POS
// Description, Vendor, Size, Department, On Hand. Never editable on mobile.
export function DetailsDisclosure({ item }: { item: PricingItem }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDListElement>(null);
  // This section sits at the bottom of the scroll zone, directly above the
  // fixed keypad dock — expanding it otherwise reveals content entirely hidden
  // behind the keypad (looks like the tap did nothing). Pull it into view.
  useEffect(() => {
    if (open) contentRef.current?.scrollIntoView({ block: "end" });
  }, [open]);
  const rows: [string, string][] = [
    ["Description", item.name],
    ["POS Description", item.posDescription ?? item.name.toUpperCase().slice(0, 22)],
    ["Vendor", item.vendorName ?? item.brand],
    ["Size", item.size ?? item.packSize],
    ["Department", item.department ?? item.category],
    ["On Hand", String(item.onHand ?? "—")],
  ];
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
      >
        Details
        {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
      </button>
      {open && (
        <dl
          ref={contentRef}
          className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
        >
          {rows.map(([label, value]) => (
            <div className="contents" key={label}>
              <dt className="text-gray-400">{label}</dt>
              <dd className="truncate text-right text-gray-700">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
