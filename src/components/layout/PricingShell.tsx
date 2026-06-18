"use client";

import { AppHeader } from "./AppHeader";
import { PageHeaderBar } from "./PageHeaderBar";
import { SummaryBar } from "./SummaryBar";
import { mockSummaryMetrics } from "@/lib/mock-data";

type Props = {
  pendingCount: number;
  /** Hide the persistent summary bar (e.g. for loading states). */
  hideSummary?: boolean;
  children: React.ReactNode;
};

export function PricingShell({ pendingCount, hideSummary, children }: Props) {
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <AppHeader alertCount={pendingCount} />

      <div className="shrink-0">
        <PageHeaderBar pendingCount={pendingCount} />
        {!hideSummary && (
          <div className="px-6 pb-3">
            <SummaryBar metrics={mockSummaryMetrics} />
          </div>
        )}
      </div>

      <main className="flex-1 px-6 pb-4 flex flex-col min-h-0">{children}</main>

      <footer className="border-t border-gray-200 bg-white py-2.5 px-6 text-center shrink-0">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">Converge™ by Deloitte</span>
          {" | "}Copyright © Deloitte Development LLC 2026. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
