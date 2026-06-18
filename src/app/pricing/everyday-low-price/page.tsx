"use client";

import { PricingQueuePage } from "@/components/pricing-table/PricingQueuePage";

export default function EdlpPage() {
  return (
    <PricingQueuePage
      active="everyday_low_price"
      catalog="edlpItems"
      newFromHqLabel="new EDLP prices from HQ"
      newFromHqCount={10}
    />
  );
}
