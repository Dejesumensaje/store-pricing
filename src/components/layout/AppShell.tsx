"use client";

import { AppSidebar } from "./AppSidebar";

/**
 * App frame: persistent left navigation rail + a content column that owns the
 * full viewport height. Page shells (PricingShell, dashboard, loose-tray) render
 * their header/main/footer inside the content column.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="shrink-0 py-3 pl-3">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
