"use client";

import type { ReactNode } from "react";
import { DataColumn } from "../DataTable";
import { PricingItem } from "@/types/pricing";
import { Tooltip } from "@dejesumensaje/converge-ds-experimental";
import Image from "next/image";
import { Image as ImageIcon, Link2 } from "lucide-react";

export { fmt } from "@/lib/format";

// `accessory` renders after the name (e.g. an "HQ" badge for items HQ flagged).
export function itemCol(accessory?: (r: PricingItem) => ReactNode): DataColumn<PricingItem> {
  return {
    id: "item",
    group: "item",
    width: 230,
    header: "Item",
    sortable: true,
    sortAccessor: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="size-9 bg-gray-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
          {r.image ? <Image src={r.image} alt={r.name} width={36} height={36} className="object-cover" /> : <ImageIcon className="size-4 text-gray-300" aria-hidden="true" />}
        </div>
        <Tooltip content={r.name}>
          <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{r.name}</span>
        </Tooltip>
        {r.familyId != null && (
          <Tooltip content="Family-priced — updates apply to the whole family">
            <span role="img" aria-label="Family-priced" className="inline-flex shrink-0 cursor-default">
              <Link2 className="size-3.5 text-gray-400" aria-hidden="true" />
            </span>
          </Tooltip>
        )}
        {accessory?.(r)}
      </div>
    ),
  };
}

export const idCol: DataColumn<PricingItem> = { id: "id", group: "item", width: 90, header: "SKU", sortable: true, sortAccessor: (r) => r.id, cell: (r) => <span className="text-sm text-gray-700">{r.id}</span> };
