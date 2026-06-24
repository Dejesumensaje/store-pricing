"use client";

import { Fuel } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { shelfTagKind, fmtShortDate } from "../store/buildStoreColumns";

// Savings the way a Hy-Vee yellow tag prints it: cents under a dollar ("78¢"),
// dollars above.
function fmtSave(amount: number): string {
  return amount < 1 ? `${Math.round(amount * 100)}¢` : fmt(amount);
}

// The white shelf tag — the regular/permanent price. Strikes the old price when
// it's changing (base / EDLP edits). When `crossed`, a red X is drawn over it —
// the way Hy-Vee marks the white tag once a yellow promo is the active price.
function WhiteTag({
  name,
  price,
  was,
  kicker,
  crossed,
}: {
  name: string;
  price: number;
  was?: number | null;
  kicker?: string;
  crossed?: boolean;
}) {
  return (
    <div className={`relative min-w-[116px] rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm ${crossed ? "opacity-80" : ""}`}>
      {kicker && <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{kicker}</p>}
      <p className="max-w-[140px] truncate text-[10px] text-gray-500">{name}</p>
      <p className="text-xl font-bold tabular-nums leading-tight text-gray-900">{fmt(price)}</p>
      <p className="text-[10px] text-gray-400">
        ea
        {was != null && Math.abs(was - price) > 0.005 && (
          <span className="ml-1 line-through">was {fmt(was)}</span>
        )}
      </p>
      {crossed && (
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true" preserveAspectRatio="none">
          <line x1="8%" y1="14%" x2="92%" y2="86%" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="92%" y1="14%" x2="8%" y2="86%" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

// The yellow promo tag — the temporary allowance the way it hangs on the shelf:
// "SAVINGS THIS WEEK", the deal, the savings off the regular price, the window.
// `proposed` dims it when it's previewing HQ's rec before the director decides.
function YellowTag({
  deal,
  save,
  dates,
  fuel,
  proposed,
}: {
  deal: string;
  save: number | null;
  dates: string | null;
  fuel: number | null;
  proposed: boolean;
}) {
  return (
    <div
      className={`relative min-w-[150px] rounded-md border-2 px-3 py-2 shadow-sm ${
        proposed ? "border-dashed border-amber-300 bg-amber-100" : "border-amber-400 bg-amber-300"
      }`}
    >
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-900">Savings this week</p>
      <p className="text-xl font-extrabold tabular-nums leading-tight text-amber-950">{deal}</p>
      {save != null && save > 0.005 && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Save {fmtSave(save)}</p>
      )}
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        {dates && <span className="text-[10px] text-amber-800">{dates}</span>}
        {fuel != null && fuel > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-blue-600 px-1 py-px text-[9px] font-bold text-white">
            <Fuel aria-hidden="true" className="size-2.5" />+{fmt(fuel)} fuel
          </span>
        )}
      </div>
      {proposed && (
        <span className="absolute -top-2 right-2 rounded-full bg-white px-1.5 text-[9px] font-semibold text-amber-700 shadow-sm">
          proposed
        </span>
      )}
    </div>
  );
}

// "What the shopper sees" — a live preview of the physical shelf tag(s) this edit
// produces. The white tag is the regular price; a temporary allowance adds the
// yellow promo tag; new/discontinued shift the white tag's kicker. Reads the
// item straight from the (already store-driven) drawer, so it updates as you type.
export function ShelfTagPreview({ item }: { item: PricingItem }) {
  const kind = shelfTagKind(item);
  const whiteNew = item.newBasePrice ?? item.currentBasePrice;

  // The yellow promo tag (temporary allowance only).
  let yellow: React.ReactNode = null;
  if (kind === "yellow") {
    const qty = item.newRetailQty ?? 1;
    const decided = item.newRetailPrice != null;
    const total = item.newRetailPrice ?? (item.hqReviewPending ? item.recommendedRetailPrice ?? null : null);
    if (total != null) {
      const perUnit = total / Math.max(1, qty);
      const deal = qty > 1 ? fmtQtyPrice(qty, total) : fmt(total);
      // Savings measured off the regular (white-tag) price; multi-unit shows the
      // whole-deal savings the way the shelf tag does.
      const save = (whiteNew - perUnit) * qty;
      const start = fmtShortDate(item.allowanceStartDate);
      const end = fmtShortDate(item.allowanceEndDate);
      const dates = end ? (start ? `${start} – ${end}` : `ends ${end}`) : null;
      yellow = <YellowTag deal={deal} save={save} dates={dates} fuel={item.fuelSaver ?? null} proposed={!decided} />;
    }
  }

  // The white tag's framing varies by lifecycle.
  const white =
    kind === "new" ? (
      <WhiteTag name={item.name} price={item.newBasePrice ?? item.recommendedBasePrice} kicker="New item" />
    ) : kind === "clearance" ? (
      <WhiteTag name={item.name} price={whiteNew} was={item.currentBasePrice} kicker="Clearance" />
    ) : (
      <WhiteTag
        name={item.name}
        price={whiteNew}
        was={item.currentBasePrice}
        kicker={kind === "edlp" ? "Every day" : undefined}
        // Once a yellow promo hangs, the white tag's regular price is crossed out
        // — the active price is the yellow one.
        crossed={yellow != null}
      />
    );

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">What the shopper sees</p>
      <div className="flex flex-wrap items-start gap-2">
        {yellow}
        {white}
      </div>
    </div>
  );
}
