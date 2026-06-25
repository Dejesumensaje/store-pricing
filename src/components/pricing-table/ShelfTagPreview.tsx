"use client";

import { Fuel } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { shelfTagKind, fmtShortDate } from "../store/buildStoreColumns";
import { STORE_NAME } from "@/lib/store-config";

// Savings the way a Hy-Vee yellow tag prints it: cents under a dollar ("78¢"),
// dollars above.
function fmtSave(amount: number): string {
  return amount < 1 ? `${Math.round(amount * 100)}¢` : fmt(amount);
}

// The "+$X fuel" chip — one light style (matches the table's fuel chip); a fuel
// saver can ride on any tag (white or yellow).
function FuelChip({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm border border-blue-200 bg-blue-50 px-1 py-px text-[9px] font-bold text-blue-700">
      <Fuel aria-hidden="true" className="size-2.5" />+{fmt(amount)} fuel
    </span>
  );
}

// The white shelf tag — the regular/permanent price. Per Neil, the shopper never
// sees the original base price, so a base edit shows ONLY the new price (no
// struck "was"). When `crossed`, a red X is drawn over it — the way Hy-Vee marks
// the white tag once a yellow promo is the active price. A fuel saver can hang on
// any item now, so the white tag carries the fuel chip too.
function WhiteTag({
  name,
  price,
  kicker,
  crossed,
  fuel,
}: {
  name: string;
  price: number;
  kicker?: string;
  crossed?: boolean;
  fuel?: number | null;
}) {
  return (
    <div className={`relative min-w-[116px] rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm ${crossed ? "opacity-80" : ""}`}>
      {kicker && <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{kicker}</p>}
      <p className="max-w-[140px] truncate text-[10px] text-gray-500">{name}</p>
      <p className="text-xl font-bold tabular-nums leading-tight text-gray-900">{fmt(price)}</p>
      <p className="text-[10px] text-gray-400">ea</p>
      {!crossed && fuel != null && fuel > 0 && (
        <div className="mt-1">
          <FuelChip amount={fuel} />
        </div>
      )}
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
// a duration-aware header, the deal, the savings off the regular price, the window.
// `proposed` dims it when it's previewing HQ's rec before the director decides.
function YellowTag({
  header,
  deal,
  save,
  dates,
  fuel,
  proposed,
}: {
  header: string;
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
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-900">{header}</p>
      <p className="text-xl font-extrabold tabular-nums leading-tight text-amber-950">{deal}</p>
      {save != null && save > 0.005 && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Save {fmtSave(save)}</p>
      )}
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        {dates && <span className="text-[10px] text-amber-800">{dates}</span>}
        {fuel != null && fuel > 0 && <FuelChip amount={fuel} />}
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
      // "Savings this week" only reads right for a ~weekly promo; a longer run
      // (2–3 weeks) gets the generic "Sale price" header.
      const spanDays =
        item.allowanceStartDate && item.allowanceEndDate
          ? Math.round(
              (new Date(`${item.allowanceEndDate}T00:00:00`).getTime() -
                new Date(`${item.allowanceStartDate}T00:00:00`).getTime()) /
                86_400_000
            )
          : null;
      const header = spanDays != null && spanDays > 8 ? "Sale price" : "Savings this week";
      yellow = <YellowTag header={header} deal={deal} save={save} dates={dates} fuel={item.fuelSaver ?? null} proposed={!decided} />;
    }
  }

  // A fuel saver hangs on the white tag only when there's no yellow promo (a TA
  // shows the fuel chip on its yellow tag instead).
  const whiteFuel = yellow == null ? item.fuelSaver ?? null : null;

  // The white tag's framing varies by lifecycle.
  const white =
    kind === "new" ? (
      <WhiteTag name={item.name} price={item.newBasePrice ?? item.recommendedBasePrice} kicker="New item" fuel={whiteFuel} />
    ) : kind === "clearance" ? (
      <WhiteTag name={item.name} price={whiteNew} kicker="Clearance" fuel={whiteFuel} />
    ) : (
      <WhiteTag
        name={item.name}
        price={whiteNew}
        kicker={kind === "edlp" ? "Every day" : undefined}
        // Once a yellow promo hangs, the white tag's regular price is crossed out
        // — the active price is the yellow one.
        crossed={yellow != null}
        fuel={whiteFuel}
      />
    );

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Pricing at {STORE_NAME}</p>
      <div className="flex flex-wrap items-start gap-2">
        {yellow}
        {white}
      </div>
    </div>
  );
}
