"use client";

import { ClipboardList, Wrench, ChevronRight } from "lucide-react";
import { Avatar } from "@dejesumensaje/converge-ds-experimental";
import { StoreSwitcher } from "@/components/layout/StoreSwitcher";
import { useActiveStore } from "@/store/pricing-store";
import { DIRECTOR } from "@/lib/store-config";

type Props = {
  onStoreWalk: () => void;
  onItemMaintenance: () => void;
};

// The mobile home keeps the desktop Hy-Vee header — same brand bar (minus
// the notifications bell) and the same StoreSwitcher + address block (minus
// Batches and the settings icon, which don't exist on mobile) — then the two
// large mode cards; nothing else competes for attention.
export function MobileHome({ onStoreWalk, onItemMaintenance }: Props) {
  const store = useActiveStore();
  return (
    <div className="flex h-full flex-col bg-white">
      <header className="bg-hyvee-red h-14 shrink-0 shadow-sm">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-xl tracking-tight">
              hy<span className="text-white/70">-</span>vee
            </span>
            <span className="text-white/40 text-lg" aria-hidden="true">
              |
            </span>
            <span className="text-white/90 font-medium text-sm">Store Pricing</span>
          </div>
          <Avatar fallback={DIRECTOR.initials} aria-label={DIRECTOR.name} />
        </div>
      </header>

      <div className="border-b border-gray-100 px-4 pb-3 pt-4">
        <StoreSwitcher />
        <p className="mt-0.5 text-base text-gray-500">{store.address}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <button
          onClick={onStoreWalk}
          className="flex min-h-28 select-none touch-manipulation flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition-transform duration-75 active:scale-[0.98] active:bg-gray-100 motion-reduce:transition-none"
        >
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/10">
              <ClipboardList className="size-5 text-brand" aria-hidden="true" />
            </span>
            <ChevronRight className="size-5 text-gray-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Store Walk</p>
            <p className="mt-0.5 text-sm text-gray-500">Edit prices now, send later</p>
          </div>
        </button>

        <button
          onClick={onItemMaintenance}
          className="flex min-h-28 select-none touch-manipulation flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition-transform duration-75 active:scale-[0.98] active:bg-gray-100 motion-reduce:transition-none"
        >
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/10">
              <Wrench className="size-5 text-brand" aria-hidden="true" />
            </span>
            <ChevronRight className="size-5 text-gray-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Item Maintenance</p>
            <p className="mt-0.5 text-sm text-gray-500">Send price changes instantly</p>
          </div>
        </button>
      </div>
    </div>
  );
}
