"use client";

import { useState } from "react";
import { Tabs, Badge } from "@dejesumensaje/converge-ds-experimental";
import { AppShell } from "@/components/layout/AppShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { CategoryCard } from "@/components/dashboard/CategoryCard";
import { mockSummaryMetrics, mockCategories } from "@/lib/mock-data";

const PERIOD_TABS = [
  { id: "current", label: "Current" },
  { id: "past", label: "Past" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("current");

  const totalNewPrices = mockCategories.reduce((s, c) => s + c.newPricesFromHQ, 0);
  const totalOverrides = mockCategories.reduce((s, c) => s + c.priceOverrides, 0);
  const totalAlerts = mockCategories.reduce((s, c) => s + c.alerts, 0);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gray-50">
      <AppHeader alertCount={totalAlerts} />

      <main className="flex-1 px-8 py-6 max-w-[1400px] mx-auto w-full">
        <Tabs
          items={PERIOD_TABS}
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-6"
        />

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">February 2026</h1>
            <p className="text-sm text-gray-500 mt-1">902 S. Locust St, Glenwood, IA 51534</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1 flex-wrap">
            <span>You have</span>
            <Badge tone="neutral">{totalNewPrices} new prices from HQ</Badge>
            <Badge tone="neutral">{totalOverrides} price overrides</Badge>
            <span>in effect, and</span>
            <Badge tone="warning">{totalAlerts} alerts</Badge>
            <span>to review.</span>
          </div>
        </div>

        <div className="mb-6">
          <SummaryCard metrics={mockSummaryMetrics} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mockCategories.map((category) => (
            <CategoryCard key={category.type} category={category} />
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-4 px-8 text-center mt-auto">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">Converge™ by Deloitte</span>
          {" "}|{" "}
          Copyright © Deloitte Development LLC 2026. All Rights Reserved.
        </p>
      </footer>
      </div>
    </AppShell>
  );
}
