"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Link2, LineChart, Package, Store } from "lucide-react";
import type { PricingItem } from "@/types/pricing";
import { effectivePrice } from "@/lib/competitors";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";

type PanelKind = "details" | "competitors" | "relationships" | "financials";

// Short labels on the pills (2 columns at 360px leaves ~15 chars before
// truncation); the full name goes on the opened panel's title.
const PANELS: { kind: PanelKind; pill: string; title: string; icon: typeof Package }[] = [
  { kind: "details", pill: "Details", title: "Product details", icon: Package },
  { kind: "competitors", pill: "Competitors", title: "Competitor prices", icon: Store },
  { kind: "relationships", pill: "Relationships", title: "Product relationships", icon: Link2 },
  { kind: "financials", pill: "Financials", title: "Financials", icon: LineChart },
];

// Reference info lives behind four pills (2-column grid) that expand into
// full-screen panels — reading is a different job from editing, so it gets
// the whole screen instead of cramming a disclosure above the keypad.
// Motion carries the affordance: pills compress on press, the panel rises in.
export function ItemInfoPills({
  item,
  liveRetail,
  familyItems,
}: {
  item: PricingItem;
  liveRetail: number;
  familyItems: PricingItem[];
}) {
  const [open, setOpen] = useState<PanelKind | null>(null);
  // The tapped pill's center, in viewport coordinates — the panel's
  // transform-origin, so the container transform grows out of THAT pill.
  const [origin, setOrigin] = useState<string>("50% 50%");

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {/* No chevron on the pills — the press-compress motion carries the
            tappable affordance, and the freed width lets every label fit. */}
        {PANELS.map(({ kind, pill, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
              setOpen(kind);
            }}
            className="flex min-h-12 select-none touch-manipulation items-center gap-2 rounded-xl bg-gray-100/70 px-3 py-2.5 text-left transition-transform duration-75 active:scale-[0.97] active:bg-gray-200 motion-reduce:transition-none"
          >
            <Icon className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-medium text-gray-600">{pill}</span>
          </button>
        ))}
      </div>

      {open && (
        <InfoPanel title={PANELS.find((p) => p.kind === open)!.title} origin={origin} onClose={() => setOpen(null)}>
          {open === "details" && <DetailsPanel item={item} />}
          {open === "competitors" && <CompetitorsPanel item={item} liveRetail={liveRetail} />}
          {open === "relationships" && <RelationshipsPanel item={item} familyItems={familyItems} />}
          {open === "financials" && <FinancialsPanel item={item} />}
        </InfoPanel>
      )}
    </>
  );
}

// Full-screen read-only panel. Container transform: grows out of the tapped
// pill (panel-grow + per-tap transform-origin); Escape / Back dismisses.
function InfoPanel({
  title,
  origin,
  onClose,
  children,
}: {
  title: string;
  origin: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={{ transformOrigin: origin }}
      className="panel-grow fixed inset-0 z-40 flex flex-col bg-white"
    >
      <div className="flex items-center border-b border-gray-100 px-2 py-1.5">
        <div className="flex flex-1 justify-start">
          <button
            ref={closeRef}
            onClick={onClose}
            className="-ml-1 flex min-h-11 select-none touch-manipulation items-center gap-0.5 rounded-lg pl-1 pr-2.5 text-sm font-medium text-gray-500 active:bg-gray-100"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            Back
          </button>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">{title}</span>
        <span className="flex-1" aria-hidden="true" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className={`min-w-0 text-right text-sm tabular-nums ${strong ? "font-semibold text-gray-900" : "text-gray-700"}`}>
        {value}
      </dd>
    </div>
  );
}

function DetailsPanel({ item }: { item: PricingItem }) {
  return (
    <dl>
      <Row label="Description" value={item.name} strong />
      <Row label="POS Description" value={item.posDescription ?? item.name.toUpperCase().slice(0, 22)} />
      <Row label="UPC" value={item.upc ?? "—"} />
      <Row label="Vendor" value={item.vendorName ?? item.brand} />
      <Row label="Brand" value={item.brand} />
      <Row label="Size" value={item.size ?? item.packSize} />
      <Row label="Department" value={item.department ?? item.category} />
      <Row label="Category" value={`${item.category} · ${item.subcategory}`} />
      <Row label="Aisle" value={item.aisle} />
      <Row label="On hand" value={String(item.onHand ?? "—")} />
    </dl>
  );
}

function CompetitorsPanel({ item, liveRetail }: { item: PricingItem; liveRetail: number }) {
  const competitors = item.competitors ?? [];
  if (competitors.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-600">No competitor prices for this item.</p>;
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span className="text-sm font-medium text-gray-700">Our shelf price</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(liveRetail)}</span>
      </div>
      <dl>
        {competitors.map((c) => {
          const price = effectivePrice(c);
          // Same INDEX the desktop column shows: ours ÷ theirs × 100 — over
          // 100 means we're pricier than that competitor.
          const index = price > 0 ? Math.round((liveRetail / price) * 100) : null;
          return (
            <Row
              key={c.name}
              label={c.distanceMi != null ? `${c.name} · ${c.distanceMi} mi` : c.name}
              value={
                <span className="flex items-baseline justify-end gap-2">
                  <span className="font-semibold text-gray-900">{fmt(price)}</span>
                  {index != null && (
                    <span className={`text-xs ${index > 100 ? "text-red-600" : "text-emerald-700"}`}>{index}</span>
                  )}
                </span>
              }
            />
          );
        })}
      </dl>
      <p className="mt-3 text-xs text-gray-500">Index = our price vs theirs (over 100 = we're pricier).</p>
    </div>
  );
}

function RelationshipsPanel({ item, familyItems }: { item: PricingItem; familyItems: PricingItem[] }) {
  if (!item.familyId || familyItems.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-600">No product relationships for this item.</p>;
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Price family{item.priceFamilyName ? ` · ${item.priceFamilyName}` : ""}
      </p>
      <p className="mb-2 text-xs text-gray-500">One shared price — editing any member updates all of them.</p>
      <dl>
        <Row label={item.name} value={fmt(perUnit(item.newBasePrice ?? item.currentBasePrice, item.newBaseQty))} strong />
        {familyItems.map((f) => (
          <Row key={f.id} label={f.name} value={fmt(perUnit(f.newBasePrice ?? f.currentBasePrice, f.newBaseQty))} />
        ))}
      </dl>
    </div>
  );
}

function FinancialsPanel({ item }: { item: PricingItem }) {
  const margin = (price: number, cost: number) => (price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : "—");
  const baseUnit = perUnit(item.newBasePrice ?? item.currentBasePrice, item.newBaseQty);
  const retailUnit = item.newRetailPrice != null ? perUnit(item.newRetailPrice, item.newRetailQty) : item.currentRetailPrice;
  // During an allowance the vendor funds part of the discount — margin on a
  // promo price is computed against the net (allowance) cost when present.
  const retailCost = item.allowanceCost ?? item.cost;
  return (
    <dl>
      <Row label="Unit cost" value={fmt(item.cost)} strong />
      {item.allowanceCost != null && <Row label="Allowance cost" value={fmt(item.allowanceCost)} />}
      <Row
        label="Base price"
        value={item.newBaseQty && item.newBaseQty > 1 ? fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice) : fmt(baseUnit)}
      />
      <Row label="Base margin" value={margin(baseUnit, item.cost)} />
      {retailUnit != null && (
        <>
          <Row
            label="Retail price"
            value={
              item.newRetailPrice != null && item.newRetailQty && item.newRetailQty > 1
                ? fmtQtyPrice(item.newRetailQty, item.newRetailPrice)
                : fmt(retailUnit)
            }
          />
          <Row label="Retail margin" value={margin(retailUnit, retailCost)} />
        </>
      )}
    </dl>
  );
}
