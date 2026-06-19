"use client";

import { Avatar, CountBadge, Button } from "@dejesumensaje/converge-ds-experimental";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

type Props = {
  /** Changes pending to send (drives the cart badge). */
  cartCount?: number;
  onCartClick?: () => void;
  cartActive?: boolean;
};

export function AppHeader({ cartCount = 0, onCartClick, cartActive }: Props) {
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
        {/* Batch tray cart: accumulates pending-to-send changes; click to review. */}
        <div className="relative inline-flex">
          <Button
            variant={cartActive ? "secondary" : "tertiary"}
            iconLeft={ShoppingCart}
            onClick={onCartClick}
            pressed={cartActive}
          >
            Batch tray
          </Button>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 pointer-events-none">
              <CountBadge count={cartCount} tone="warning" />
            </span>
          )}
        </div>
        <Avatar fallback="NL" />
      </div>
    </header>
  );
}
