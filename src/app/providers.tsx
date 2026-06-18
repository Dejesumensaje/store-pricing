"use client";

import { TooltipProvider, ToastProvider } from "@dejesumensaje/converge-ds-experimental";
import { PendingChangesDrawer } from "@/components/pending/PendingChangesDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TooltipProvider>
        {children}
        <PendingChangesDrawer />
      </TooltipProvider>
    </ToastProvider>
  );
}
