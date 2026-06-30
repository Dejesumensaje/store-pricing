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
    <header className="bg-hyvee-red h-14 sticky top-0 z-30 shadow-sm">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-white font-bold text-xl tracking-tight">
            hy<span className="text-white/70">-</span>vee
          </span>
          <span className="text-white/40 text-lg" aria-hidden="true">|</span>
          <span className="text-white/90 font-medium text-sm">Store Pricing</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative inline-flex text-white [&_button]:text-white [&_button:hover]:bg-white/15">
          {/* Bell is decorative here — the button's aria-label carries the accessible name.
              The DS Button should apply aria-hidden="true" to the iconLeft SVG it renders. */}
          <Button
            variant="tertiary"
            iconLeft={Bell}
            aria-label={hasNotifications ? `${hqCount} HQ recommendations` : "Notifications"}
            onClick={onViewHq}
          />
          {hasNotifications && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 pointer-events-none">
              <CountBadge count={hqCount} tone="in-progress" />
            </span>
          )}
        </div>
        <Avatar fallback="NL" />
      </div>
      </div>
    </header>
  );
}
