"use client";

import { Badge } from "@dejesumensaje/converge-ds-experimental";
import Link from "next/link";
import { CategorySummary } from "@/types/pricing";

type Props = { category: CategorySummary };

const categoryPaths: Record<string, string> = {
  base: "/pricing/base",
  temporary_allowance: "/pricing/temporary-allowance",
  everyday_low_price: "/pricing/everyday-low-price",
  no_change: "/pricing/no-change",
  new_discontinued: "/pricing/new-discontinued",
};

export function CategoryCard({ category }: Props) {
  const hasAlerts = category.alerts > 0;

  return (
    <Link href={categoryPaths[category.type] ?? "#"}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-gray-900 text-sm">{category.label}</span>
          {hasAlerts && (
            <Badge tone="warning" size="sm">
              {category.alerts} alerts
            </Badge>
          )}
        </div>
        <p className="text-gray-500 text-xs leading-relaxed flex-1">{category.description}</p>
        <div className="flex items-center gap-3 pt-1">
          <Badge tone="neutral" size="sm">{category.newPricesFromHQ} new prices from HQ</Badge>
          <Badge tone={category.priceOverrides > 0 ? "in-progress" : "neutral"} size="sm">
            {category.priceOverrides} price overrides
          </Badge>
        </div>
      </div>
    </Link>
  );
}
