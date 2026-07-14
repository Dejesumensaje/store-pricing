"use client";

import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { PricingItem } from "@/types/pricing";
import { RELATIONSHIP_META, RELATIONSHIP_TYPE_ORDER, relationshipsFor } from "@/lib/product-relationships";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { perUnit, round2 } from "@/lib/pricing-math";
import { CollapsibleSection } from "./CollapsibleSection";

type Props = {
  item: PricingItem;
  itemsById: Map<string, PricingItem>;
};

function MemberRow({ member, label, isCurrent }: { member: PricingItem; label?: string; isCurrent: boolean }) {
  const price =
    member.newBasePrice != null ? (
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="text-gray-400 line-through">{fmt(member.currentBasePrice)}</span>
        <span aria-hidden="true" className="text-gray-300">→</span>
        <span className="font-medium text-gray-900">{fmtQtyPrice(member.newBaseQty, member.newBasePrice)}</span>
      </span>
    ) : (
      <span className="tabular-nums text-gray-500">{fmt(member.currentBasePrice)}</span>
    );
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {label && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
          )}
          <p className={`truncate text-sm ${isCurrent ? "font-medium text-gray-900" : "text-gray-700"}`}>{member.name}</p>
          {isCurrent && <Badge tone="neutral" size="sm">This item</Badge>}
        </div>
        <p className="text-xs text-gray-500">{member.id}</p>
      </div>
      <div className="shrink-0 text-sm">{price}</div>
    </div>
  );
}

// Mobile: drop the Price/UoM column — 3-column grid gives item name ~95px,
// readable enough. Desktop keeps all four columns.
const SIZE_PARITY_GRID = "grid grid-cols-[1fr_4.5rem_6.5rem] items-center gap-3 md:grid-cols-[1fr_4.5rem_6.5rem_5rem]";

/** Column header row for size-group sections (item code/description, size, base price, price/UoM). */
function SizeParityHeader() {
  return (
    <div className={`${SIZE_PARITY_GRID} px-4 py-1.5 border-b border-gray-100 bg-gray-50`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Item</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Size</span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Base price</span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400 max-md:hidden">Price / UoM</span>
    </div>
  );
}

/** Size-group row: adds Size and Price/UoM (base price ÷ oz) to the standard fields. */
function SizeParityRow({ member, label, isCurrent }: { member: PricingItem; label?: string; isCurrent: boolean }) {
  // newBasePrice is the TOTAL for newBaseQty units — normalize to per-unit before dividing by oz.
  const perUnitBase =
    member.newBasePrice != null ? perUnit(member.newBasePrice, member.newBaseQty) : member.currentBasePrice;
  const size = label ?? member.packSize;
  const ozNumber = parseFloat(size);
  const priceUom = ozNumber > 0 ? fmt(round2(perUnitBase / ozNumber)) : null;
  const price =
    member.newBasePrice != null ? (
      <span className="flex items-center justify-end gap-1.5 tabular-nums">
        <span className="text-gray-400 line-through">{fmt(member.currentBasePrice)}</span>
        <span aria-hidden="true" className="text-gray-300">→</span>
        <span className="font-medium text-gray-900">{fmtQtyPrice(member.newBaseQty, member.newBasePrice)}</span>
      </span>
    ) : (
      <span className="tabular-nums text-gray-500">{fmt(member.currentBasePrice)}</span>
    );
  return (
    <div className={`${SIZE_PARITY_GRID} px-4 py-2 border-b border-gray-100 last:border-0`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm ${isCurrent ? "font-medium text-gray-900" : "text-gray-700"}`}>{member.name}</p>
          {isCurrent && <Badge tone="neutral" size="sm">This item</Badge>}
        </div>
        <p className="text-xs text-gray-500">{member.id}</p>
      </div>
      <span className="text-xs text-gray-500">{size}</span>
      <div className="text-right text-sm">{price}</div>
      <span className="text-right text-sm tabular-nums text-gray-700 max-md:hidden">{priceUom ?? "—"}</span>
    </div>
  );
}

export function ProductRelationships({ item, itemsById }: Props) {
  const relationships = relationshipsFor(item.id).sort(
    (a, b) => RELATIONSHIP_TYPE_ORDER.indexOf(a.type) - RELATIONSHIP_TYPE_ORDER.indexOf(b.type)
  );

  const sections = relationships
    .map((rel) => {
      const meta = RELATIONSHIP_META[rel.type];
      const members = rel.itemIds
        .map((id) => itemsById.get(id))
        .filter((m): m is PricingItem => m != null);
      if (members.length === 0) return null;
      return (
        <CollapsibleSection
          key={rel.id}
          title={
            <>
              {meta.label} <span className="font-normal text-gray-400">· {rel.name}</span>
            </>
          }
          count={members.length}
        >
          <div className="-mx-4 -my-3">
            {rel.type === "size_parity" && <SizeParityHeader />}
            {members.map((m) =>
              rel.type === "size_parity" ? (
                <SizeParityRow key={m.id} member={m} label={rel.memberLabels?.[m.id]} isCurrent={m.id === item.id} />
              ) : (
                <MemberRow key={m.id} member={m} label={rel.memberLabels?.[m.id]} isCurrent={m.id === item.id} />
              )
            )}
          </div>
        </CollapsibleSection>
      );
    })
    .filter((s) => s != null);

  if (sections.length === 0) return null;

  // One <section> per the drawer's heading-above-content grammar: the group
  // reads as a single unit (20px drawer gap outside, 8px inside), and the
  // accordion titles carry only what changes between relationships.
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-700">Product relationships</h3>
      {sections}
    </section>
  );
}
