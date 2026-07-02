"use client";

import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { AlertTriangle } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { RELATIONSHIP_META, relationshipsFor } from "@/lib/product-relationships";
import { Violation } from "@/lib/relationship-validation";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CollapsibleSection } from "./CollapsibleSection";

type Props = {
  item: PricingItem;
  itemsById: Map<string, PricingItem>;
  relatedFallback: PricingItem[];
  /** Soft (narrow-gap) violations — flags the involved member rows amber. */
  softViolations?: Violation[];
};

function MemberRow({ member, label, isCurrent, flagged }: { member: PricingItem; label?: string; isCurrent: boolean; flagged?: boolean }) {
  const price =
    member.newBasePrice != null ? (
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="text-gray-400 line-through">{fmt(member.currentBasePrice)}</span>
        <span aria-hidden="true" className="text-gray-300">→</span>
        <span className={`font-medium ${flagged ? "text-amber-700" : "text-gray-900"}`}>{fmtQtyPrice(member.newBaseQty, member.newBasePrice)}</span>
      </span>
    ) : (
      <span className={`tabular-nums ${flagged ? "text-amber-700" : "text-gray-500"}`}>{fmt(member.currentBasePrice)}</span>
    );
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {label && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
          )}
          <p className={`truncate text-sm ${isCurrent ? "font-medium text-gray-900" : "text-gray-700"}`}>{member.name}</p>
          {flagged && <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-label="Narrow price gap" />}
          {isCurrent && <Badge tone="neutral" size="sm">This item</Badge>}
        </div>
        <p className="text-xs text-gray-500">{member.id}</p>
      </div>
      <div className="shrink-0 text-sm">{price}</div>
    </div>
  );
}

export function ProductRelationships({ item, itemsById, relatedFallback, softViolations }: Props) {
  const relationships = relationshipsFor(item.id);
  const typedIds = new Set(relationships.flatMap((r) => r.itemIds));
  const untyped = relatedFallback.filter((ri) => !typedIds.has(ri.id) && ri.id !== item.id);
  // Scoped per relationship: an item flagged in its size-parity group must not
  // glow amber inside an unrelated subgroup it also belongs to.
  const flaggedIds = new Set(
    (softViolations ?? []).flatMap((v) => [
      `${v.relationship.id}:${v.offenderId}`,
      `${v.relationship.id}:${v.comparatorId}`,
    ])
  );

  if (relationships.length === 0 && untyped.length === 0) return null;

  const count = relationships.length + (untyped.length > 0 ? 1 : 0);

  return (
    <CollapsibleSection
      title={
        <>
          Product relationships <span className="font-normal text-gray-400">· base prices</span>
        </>
      }
      count={count}
      defaultOpen
    >
      <div className="-mx-4 -my-3">
        {relationships.map((rel) => {
          const meta = RELATIONSHIP_META[rel.type];
          const members = rel.itemIds
            .map((id) => itemsById.get(id))
            .filter((m): m is PricingItem => m != null);
          if (members.length === 0) return null;
          return (
            <div key={rel.id}>
              <div className="flex flex-col gap-0.5 bg-gray-50 px-4 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" size="sm">{meta.label}</Badge>
                  <span className="text-sm font-medium text-gray-700">{rel.name}</span>
                </div>
                <span className="text-xs text-gray-500">{meta.description}</span>
              </div>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  label={rel.memberLabels?.[m.id]}
                  isCurrent={m.id === item.id}
                  flagged={flaggedIds.has(`${rel.id}:${m.id}`)}
                />
              ))}
            </div>
          );
        })}
        {untyped.length > 0 && (
          <div>
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Priced together</span>
            </div>
            {untyped.map((m) => (
              <MemberRow key={m.id} member={m} isCurrent={false} />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
