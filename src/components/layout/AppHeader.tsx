"use client";

import { Avatar, Button } from "@dejesumensaje/converge-ds-experimental";
import { Bell } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
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
        <Button variant="tertiary" iconLeft={Bell} aria-label="Notifications" />
        <Avatar fallback="NL" />
      </div>
    </header>
  );
}
