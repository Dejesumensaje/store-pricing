"use client";

import { Avatar, Button, CountBadge } from "@dejesumensaje/converge-ds-experimental";
import { Bell } from "lucide-react";
import Link from "next/link";

type Props = {
  /** Count of HQ recommendations awaiting the store's action. */
  hqCount?: number;
  /** Jump to the HQ Recommendations view (e.g. from the notifications bell). */
  onViewHq?: () => void;
};

export function AppHeader({ hqCount = 0, onViewHq }: Props) {
  const hasNotifications = hqCount > 0;
  return (
    <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-red-600 font-bold text-xl tracking-tight">
            hy<span className="text-red-400">-</span>vee
          </span>
          <span className="text-gray-300 text-lg" aria-hidden="true">|</span>
          <span className="text-gray-800 font-medium text-sm">Store Pricing</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative inline-flex">
          <Button
            variant="tertiary"
            iconLeft={Bell}
            aria-label={hasNotifications ? `${hqCount} HQ recommendations` : "Notifications"}
            onClick={onViewHq}
          />
          {hasNotifications && (
            <span className="absolute -top-1 -right-1 pointer-events-none">
              <CountBadge count={hqCount} tone="warning" />
            </span>
          )}
        </div>
        <Avatar fallback="NL" />
      </div>
    </header>
  );
}
