"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, History, Link2, Package, Store } from "lucide-react";
import type { PricingItem, PriceHistoryEntry } from "@/types/pricing";
import { usePricingStore } from "@/store/pricing-store";
import { orderCompetitors, effectivePrice, competitorIndex, priceDiffLabel, priceDiffClass } from "@/lib/competitors";
import { fmt, fmtDateShort } from "@/lib/format";
import { REASON_META, type PriceChangeReason } from "@/lib/price-change-reason";
import { perUnit, round2 } from "@/lib/pricing-math";
import {
  relationshipsFor,
  RELATIONSHIP_META,
  RELATIONSHIP_TYPE_ORDER,
  minGapFor,
  type ProductRelationship,
} from "@/lib/product-relationships";

type PanelKind = "details" | "competitors" | "relationships" | "history";

// Short labels on the cards; the full name goes on the opened panel's title.
// Four equal cards in a 2×2 grid (evidence tiles) — a balanced, glanceable set.
// Each is a vertical tile: icon, label, one-line status (the panel's headline
// fact).
const PANELS: { kind: PanelKind; pill: string; title: string; icon: typeof Package }[] = [
  { kind: "details", pill: "Details", title: "Product details", icon: Package },
  { kind: "competitors", pill: "Competitors", title: "Competitor prices", icon: Store },
  // Card label is "Groups" (fits the narrow column); the panel keeps the full
  // "Product relationships" title.
  { kind: "relationships", pill: "Groups", title: "Product relationships", icon: Link2 },
  { kind: "history", pill: "History", title: "Price history", icon: History },
];

// Reference info lives behind four pills (2-column grid) that expand into
// full-screen panels — reading is a different job from editing, so it gets
// the whole screen instead of cramming a disclosure above the keypad.
// Each pill carries a one-line LIVE status (the panel's headline fact) so
// the calm posture answers the common question without a tap. Motion carries
// the affordance: pills compress on press, the panel rises in.
export function ItemInfoPills({
  item,
  familyItems,
  draftBaseUnit,
}: {
  item: PricingItem;
  familyItems: PricingItem[];
  /** The in-progress base draft (per unit) — lights the Relationships pill
      and drives the panel's ripple while a family price is being moved. */
  draftBaseUnit: number | null;
}) {
  const [open, setOpen] = useState<PanelKind | null>(null);
  // The tapped pill's center, in viewport coordinates — the panel's
  // transform-origin, so the container transform grows out of THAT pill.
  const [origin, setOrigin] = useState<string>("50% 50%");

  const competitorCount = (item.competitors ?? []).length;
  const historyCount = (item.priceHistory ?? []).length;
  // Only LINE PRICING (family) propagates: editing the base price overwrites
  // every member of the shared group. The other relationship types (size
  // groups, good-better-best, private-label/national-brand) are comparison
  // ladders — membership matters for validation, but an edit never rewrites
  // them. So the headline leads with the line-pricing consequence when there
  // is one, and otherwise just reports how many other groups the item sits in.
  const otherGroups = relationshipsFor(item.id).filter((r) => r.type !== "family").length;
  const hasFamily = !!item.familyId && familyItems.length > 0;
  const status: Record<PanelKind, { text: string; live?: boolean }> = {
    // Price sensitivity (H/M/L) is the one Detail short enough to glance in a
    // narrow tile — the UPC and the rest live one tap away in the panel.
    details: { text: `Sensitivity ${item.sensitivity}` },
    competitors: { text: competitorCount > 0 ? `${competitorCount} tracked` : "None tracked" },
    // Line pricing → how many connected items an edit would move. Else →
    // membership in the comparison groups. Else → nothing.
    // Copy kept short — these ride in a narrow tile; the full picture is one
    // tap away in the panel.
    relationships: hasFamily
      ? { text: `${familyItems.length} follow`, live: draftBaseUnit != null }
      : otherGroups > 0
        ? { text: `${otherGroups} related` }
        : { text: "Priced alone" },
    history: { text: historyCount > 0 ? `${historyCount} change${historyCount === 1 ? "" : "s"}` : "No history" },
  };

  const openPanel = (kind: PanelKind, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // The tapped pill's center is the panel's transform-origin, so it grows
    // out of THAT pill.
    setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
    setOpen(kind);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {PANELS.map(({ kind, pill, icon: Icon }) => (
          <Pill key={kind} pill={pill} Icon={Icon} status={status[kind]} onOpen={(el) => openPanel(kind, el)} />
        ))}
      </div>

      {open && (
        <InfoPanel title={PANELS.find((p) => p.kind === open)!.title} origin={origin} onClose={() => setOpen(null)}>
          {open === "details" && <DetailsPanel item={item} />}
          {open === "competitors" && <CompetitorsPanel item={item} />}
          {open === "relationships" && <RelationshipsPanel item={item} />}
          {open === "history" && <HistoryPanel item={item} />}
        </InfoPanel>
      )}
    </>
  );
}

// One evidence tile — a vertical card sized to sit three-across at 360px:
// icon, label, one-line status (the panel's headline fact). Narrow columns
// can't hold the icon and label side by side, so they stack; the label is free
// to wrap to a second line and the grid stretches every tile to match, keeping
// the row balanced. No chevron — the press-compress motion carries the
// tappable affordance.
function Pill({
  pill,
  Icon,
  status,
  onOpen,
}: {
  pill: string;
  Icon: typeof Package;
  status: { text: string; live?: boolean };
  onOpen: (el: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      className="flex min-h-[84px] select-none touch-manipulation flex-col items-start gap-1 rounded-xl bg-gray-100/70 px-2.5 py-3 text-left transition-transform duration-75 active:scale-[0.97] active:bg-gray-200 motion-reduce:transition-none"
    >
      <Icon className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span className="mt-0.5 w-full text-sm font-medium leading-tight text-gray-700">{pill}</span>
      <span
        className={`mt-auto w-full truncate text-[11px] tabular-nums ${
          status.live ? "font-medium text-brand" : "text-gray-400"
        }`}
      >
        {status.text}
      </span>
    </button>
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

// Trimmed to the identity fields a director actually reads on a walk. Price
// sensitivity (H/M/L) is the one that also headlines the tile at rest.
const SENSITIVITY_LABEL: Record<PricingItem["sensitivity"], string> = { H: "High", M: "Medium", L: "Low" };

function DetailsPanel({ item }: { item: PricingItem }) {
  return (
    <dl>
      <Row label="UPC" value={item.upc ?? "—"} />
      <Row label="Description" value={item.name} strong />
      <Row label="Department" value={item.department ?? item.category} />
      <Row label="Category" value={item.category} />
      <Row label="Vendor" value={item.vendorName ?? item.brand} />
      <Row label="Price sensitivity" value={`${SENSITIVITY_LABEL[item.sensitivity]} (${item.sensitivity})`} />
    </dl>
  );
}

const COMP_FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-gray-400";
// A quiet brand tag marking the price type the director moved on this item.
const COMP_CHANGED_TAG = "mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand";

// The desktop competitor table (CompetitorPrices.tsx), reworked for the mobile
// panel: same columns and data — Our-price anchor doubling as the column header
// (Base · Retail · Index), each competitor's effective price with its colored
// diff vs ours, a manual-correction strikethrough, distance/address meta and
// the "Added by you" badge. Store names are short, so the tighter grid keeps
// ALL columns — the Index one desktop drops on narrow screens stays here.
function CompetitorsPanel({ item }: { item: PricingItem }) {
  // Compare per-unit, pending-aware — mirrors the desktop table exactly.
  const ourBase = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
  const ourRetail =
    item.newRetailPrice != null
      ? perUnit(item.newRetailPrice, item.newRetailQty)
      : item.category_type === "temporary_allowance"
        ? item.currentRetailPrice ?? null
        : null;
  // Which price type the director has moved on this item — surfaced against the
  // competitive set so the reader knows whether an index shift reflects a base
  // or a deal decision (or both). Mirrors the pending-aware ourBase/ourRetail.
  const baseChanged = item.newBasePrice != null;
  const retailChanged = item.newRetailPrice != null;
  const competitors = orderCompetitors(item.competitors ?? []);
  if (competitors.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-600">No competitor prices for this item.</p>;
  }
  const showRetail = ourRetail != null || competitors.some((c) => c.retailPrice != null);
  const grid = showRetail
    ? "grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem_2.25rem] items-start gap-1.5"
    : "grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-start gap-2";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* The Our-price row doubles as column header (stacked labels) and the
          comparison anchor — index 1.00 = our base. */}
      <div className={`${grid} border-b border-gray-100 bg-gray-50 px-3 py-2`}>
        <span className="self-center text-xs font-medium text-gray-500">Our price</span>
        <span className="flex flex-col items-end tabular-nums">
          <span className={COMP_FIELD_LABEL}>Base</span>
          <span className="text-sm font-semibold text-gray-900">{fmt(ourBase)}</span>
          {baseChanged && <span className={COMP_CHANGED_TAG}>changed</span>}
        </span>
        {showRetail && (
          <span className="flex flex-col items-end tabular-nums">
            <span className={COMP_FIELD_LABEL}>Retail</span>
            <span className="text-sm font-semibold text-gray-900">{ourRetail != null ? fmt(ourRetail) : "—"}</span>
            {retailChanged && <span className={COMP_CHANGED_TAG}>changed</span>}
          </span>
        )}
        <span className="flex flex-col items-end tabular-nums">
          <span className={COMP_FIELD_LABEL}>Index</span>
          <span className="text-xs text-gray-400">1.00</span>
        </span>
      </div>
      {competitors.map((c) => {
        const price = effectivePrice(c);
        const baseDiff = ourBase - price;
        const retailDiff = c.retailPrice != null && ourRetail != null ? ourRetail - c.retailPrice : null;
        const meta =
          c.source === "user"
            ? c.address ?? null
            : [c.distanceMi != null ? `${c.distanceMi} mi` : null, c.address ?? null].filter(Boolean).join(" · ") || null;
        return (
          <div key={c.name} className={`${grid} border-b border-gray-100 px-3 py-2 last:border-0`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-sm text-gray-700">{c.name}</span>
                {c.source === "user" && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">Added by you</span>
                )}
              </div>
              {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
            </div>
            <div className="flex flex-col items-end tabular-nums">
              {c.manualPrice != null ? (
                <span className="flex items-center gap-0.5 text-sm">
                  <span className="text-gray-400 line-through">{fmt(c.price)}</span>
                  <span aria-hidden="true" className="text-gray-300">→</span>
                  <span className="font-medium text-gray-900">{fmt(c.manualPrice)}</span>
                </span>
              ) : (
                <span className="text-sm text-gray-700">{fmt(price)}</span>
              )}
              <span className={`text-[11px] font-medium ${priceDiffClass(baseDiff)}`}>{priceDiffLabel(baseDiff, price)}</span>
            </div>
            {showRetail && (
              <div className="flex flex-col items-end tabular-nums">
                {c.retailPrice != null ? (
                  <>
                    <span className="text-sm text-gray-700">{fmt(c.retailPrice)}</span>
                    {retailDiff != null && (
                      <span className={`text-[11px] font-medium ${priceDiffClass(retailDiff)}`}>
                        {priceDiffLabel(retailDiff, c.retailPrice)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
            )}
            <span className="self-start text-right text-xs text-gray-500">
              {competitorIndex(c, ourBase)?.toFixed(2) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const HISTORY_TYPE_LABEL: Record<PriceHistoryEntry["type"], string> = {
  base: "Base price",
  retail: "Retail",
  fuel: "Fuel Saver",
};

// Price history — the item's recent price changes, most-recent first. Kept per
// CHANGE, not per day: changes are sparse and irregular, so we show the last 10
// regardless of age (never a fixed time window). Each row states what moved
// (base / retail / fuel), the old → new value struck through, when, and the
// reason code — the same catalog the live decision flow uses.
function HistoryPanel({ item }: { item: PricingItem }) {
  const history = [...(item.priceHistory ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  if (history.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-600">No recorded price changes for this item.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {history.map((h, i) => (
        <div
          key={`${h.date}-${h.type}-${i}`}
          className="flex items-start justify-between gap-3 border-b border-gray-100 px-3 py-2.5 last:border-0"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-sm font-medium text-gray-800">{HISTORY_TYPE_LABEL[h.type]}</span>
              <span className="text-xs tabular-nums text-gray-400">{fmtDateShort(h.date)}</span>
            </div>
            <div className="truncate text-xs text-gray-500">
              {REASON_META[h.reason as PriceChangeReason]?.label ?? h.reason}
            </div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-sm tabular-nums">
            <span className="text-gray-400 line-through">{fmt(h.from)}</span>
            <span aria-hidden="true" className="mx-1 text-gray-300">
              →
            </span>
            <span className="font-semibold text-gray-900">{fmt(h.to)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const REL_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-gray-400";

// Effective per-unit base price (pending override wins over the live price) —
// the value every relationship row compares on, and the ladder gap runs against.
const relBaseUnit = (m: PricingItem) =>
  m.newBasePrice != null ? perUnit(m.newBasePrice, m.newBaseQty) : m.currentBasePrice;

// Base-price cell: the effective price, with the pre-change price struck through
// beneath when a member carries a pending base override.
function BasePriceCell({ m, current }: { m: PricingItem; current: boolean }) {
  return (
    <span className="flex flex-col items-end leading-tight tabular-nums">
      <span className={`text-sm ${current ? "font-semibold text-gray-900" : "text-gray-700"}`}>{fmt(relBaseUnit(m))}</span>
      {m.newBasePrice != null && (
        <span className="text-[10px] text-gray-400 line-through">was {fmt(m.currentBasePrice)}</span>
      )}
    </span>
  );
}

// A group's spacing rules, split by how strictly each is enforced — the
// distinction the store team asked to see plainly. `hard` is a REQUIRED
// ordering constraint: breaking it blocks the save (a hard ladder break). `soft`
// is a GUIDELINE: the minimum step below which a gap reads as "narrow" (the amber
// marker in the table) — a warning, never a block. Rendered as two tagged lines
// under the section title, so every gap on screen has a stated reference and its
// weight is unambiguous, no tap required.
function ruleCaption(rel: ProductRelationship): { hard: string; soft: string | null } {
  const min = minGapFor(rel);
  switch (rel.type) {
    case "family":
      return { hard: "All members share one base price", soft: null };
    case "size_parity":
      return { hard: "Larger sizes price above smaller", soft: `steps ≥${min}%` };
    case "good_better_best":
      return { hard: "Higher tiers price above lower", soft: `steps ≥${min}%` };
    case "brand_pair":
      return { hard: "National brand above private label", soft: `gap ≥${min}%` };
    default:
      return { hard: "", soft: null };
  }
}

// The two rule weights, tagged. Hard = neutral/strong (it's enforced); soft =
// amber, tying the guideline to the amber "narrow" gap marker in the table.
const RULE_TAG = "shrink-0 text-[10px] font-semibold uppercase tracking-wide";

// Collapsible relationship section. The gap rule rides as an always-visible
// caption under the title (mobile has no hover, and this info is worth showing
// outright) — the min-gap threshold set in medium so the eye lands on it.
function RelSection({
  title,
  caption,
  count,
  defaultOpen,
  children,
}: {
  title: React.ReactNode;
  caption: { hard: string; soft: string | null };
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full select-none touch-manipulation items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-700">
            {title} <span className="font-normal text-gray-400">({count})</span>
          </span>
          {/* Two weights, plainly tagged: what's ENFORCED vs what's a guideline. */}
          {caption.hard && (
            <span className="mt-1 flex items-baseline gap-1.5 text-xs text-gray-500">
              <span className={`${RULE_TAG} text-gray-500`}>Required</span>
              <span className="min-w-0">{caption.hard}</span>
            </span>
          )}
          {caption.soft && (
            <span className="mt-0.5 flex items-baseline gap-1.5 text-xs text-gray-400">
              <span className={`${RULE_TAG} text-amber-600`}>Guideline</span>
              <span className="min-w-0 tabular-nums">{caption.soft}</span>
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-gray-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

// The desktop Product relationships (ProductRelationships.tsx), reworked for the
// mobile panel: one collapsible section per relationship (scales when an item
// sits in many groups), each with column headers that name the values as BASE
// PRICE — plus SIZE and PRICE / UoM for size groups. Between adjacent ranked
// members we show the base-price GAP (amber when tighter than the ladder's
// minimum), and a ⓘ tooltip states the rule that sets those bands.
function RelationshipsPanel({ item }: { item: PricingItem }) {
  const items = usePricingStore((s) => s.items);
  const relationships = relationshipsFor(item.id).sort(
    (a, b) => RELATIONSHIP_TYPE_ORDER.indexOf(a.type) - RELATIONSHIP_TYPE_ORDER.indexOf(b.type)
  );
  if (relationships.length === 0) {
    return <p className="mt-10 text-center text-sm text-gray-600">No product relationships for this item.</p>;
  }
  const lookup = (id: string) => (id === item.id ? item : items.find((i) => i.id === id));

  return (
    <div className="flex flex-col gap-2">
      {relationships.map((rel) => {
        const meta = RELATIONSHIP_META[rel.type];
        const members = rel.itemIds.map(lookup).filter((m): m is PricingItem => m != null);
        if (members.length === 0) return null;
        const isSize = rel.type === "size_parity";
        const isFamily = rel.type === "family";
        const minGap = minGapFor(rel);
        const grid = isSize
          ? "grid grid-cols-[minmax(0,1fr)_3.25rem_4.75rem_3rem] items-center gap-2"
          : "grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-2";
        return (
          <RelSection
            key={rel.id}
            defaultOpen
            count={members.length}
            caption={ruleCaption(rel)}
            title={meta.label}
          >
            <div className="-mx-4 -my-3">
              <div className={`${grid} bg-gray-50 px-4 py-2`}>
                <span className={REL_LABEL}>Item</span>
                {isSize && <span className={REL_LABEL}>Size</span>}
                <span className={`${REL_LABEL} text-right`}>Base price</span>
                {isSize && <span className={`${REL_LABEL} text-right`}>Price / UoM</span>}
              </div>
              {members.map((m, i) => {
                const current = m.id === item.id;
                const chip = rel.memberLabels?.[m.id];
                const size = isSize ? chip ?? m.packSize : null;
                const oz = size ? parseFloat(size) : NaN;
                const uom = isSize ? (oz > 0 ? fmt(round2(relBaseUnit(m) / oz)) : "—") : null;
                const prevUnit = i > 0 ? relBaseUnit(members[i - 1]) : 0;
                const gap = prevUnit > 0 ? (relBaseUnit(m) / prevUnit - 1) * 100 : 0;
                const narrow = minGap > 0 && gap < minGap - 0.05;
                return (
                  <Fragment key={m.id}>
                    {/* Separator between members. For ranked ladders it carries
                        the base-price step, sitting ON the divider (no empty
                        band); line-priced members share one price, so a plain
                        rule. */}
                    {i > 0 &&
                      (isFamily ? (
                        <div className="mx-4 h-px bg-gray-100" />
                      ) : (
                        <div className="flex items-center gap-2 px-4">
                          <span className="h-px flex-1 bg-gray-100" />
                          <span
                            className={`shrink-0 py-1 text-[11px] tabular-nums ${
                              narrow ? "font-medium text-amber-600" : "text-gray-400"
                            }`}
                          >
                            ↑ {Math.abs(gap).toFixed(1)}%{narrow ? " narrow" : ""}
                          </span>
                        </div>
                      ))}
                    <div className={`${grid} px-4 py-2.5`}>
                      <div className="min-w-0">
                        {/* Full name gets the whole line — the current item is
                            marked by the row tint + a brand tag on the meta line,
                            not a chip competing with the name. */}
                        <p className={`truncate text-sm ${current ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {m.name}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {current && <span className="font-semibold text-brand">This item</span>}
                          {current && " · "}
                          {!isSize && chip && (
                            <>
                              <span className="font-medium uppercase tracking-wide">{chip}</span> ·{" "}
                            </>
                          )}
                          {m.id}
                        </p>
                      </div>
                      {isSize && <span className="text-xs text-gray-500">{size}</span>}
                      <BasePriceCell m={m} current={current} />
                      {isSize && <span className="text-right text-sm tabular-nums text-gray-700">{uom}</span>}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </RelSection>
        );
      })}
    </div>
  );
}
