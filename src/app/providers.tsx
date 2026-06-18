"use client";

import { TooltipProvider, ToastProvider } from "@dejesumensaje/converge-ds-experimental";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </ToastProvider>
  );
}
