"use client";

import { Avatar, CountBadge, Button } from "@dejesumensaje/converge-ds-experimental";
import { Bell } from "lucide-react";
import Link from "next/link";

// Link is still used by the logo (returns to the single store screen).

type Props = { alertCount?: number; onBellClick?: () => void };

export function AppHeader({ alertCount = 0, onBellClick }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-red-600 font-bold text-xl tracking-tight">
            hy<span className="text-red-400">-</span>vee
          </span>
          <span className="text-gray-300 text-lg">|</span>
          <span className="text-gray-800 font-medium text-sm">Store Pricing</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative inline-flex">
          <Button variant="tertiary" iconLeft={Bell} aria-label="Notifications" onClick={onBellClick} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 pointer-events-none">
              <CountBadge count={alertCount} tone="warning" />
            </span>
          )}
        </div>
        <Avatar fallback="NL" />
      </div>
    </header>
  );
}
