"use client";

import { StoreSwitcher } from "@/components/layout/StoreSwitcher";
import { useActiveStore } from "@/store/pricing-store";

// Rendered as a fragment so the store switcher, address, and the sibling
// Batch-tray button are all direct flex children of the page header row.
// `order` + the address's `w-full md:w-auto` drive the responsive wrap:
//   mobile  → row 1: switcher ⋯ batch tray (pinned right) / row 2: address
//   desktop → switcher · address ⋯⋯⋯ batch tray (single row)
export function StorePricingHeader() {
  const store = useActiveStore();
  return (
    <>
      <StoreSwitcher />
      <div className="order-3 w-full md:order-2 md:w-auto">
        <span className="text-base text-gray-500 md:ml-1">{store.address}</span>
      </div>
    </>
  );
}
