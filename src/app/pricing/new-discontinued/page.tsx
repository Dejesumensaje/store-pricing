"use client";

import { PricingQueuePage } from "@/components/pricing-table/PricingQueuePage";

export default function NewDiscontinuedPage() {
  return (
    <PricingQueuePage
      active="new_discontinued"
      catalog="newDiscontinuedItems"
      newFromHqLabel="new / discontinued from HQ"
      newFromHqCount={10}
    />
  );
}
