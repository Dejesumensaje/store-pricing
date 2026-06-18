"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type SidebarItem } from "@dejesumensaje/converge-ds-experimental";
import { LayoutDashboard, Layers, List, Inbox } from "lucide-react";

type NavDef = { id: string; label: string; icon: SidebarItem["icon"]; href: string };

// Batches is the centerpiece of the experience — placed directly under the
// dashboard so it reads as a primary destination, not a buried sub-view.
const PRIMARY_NAV: NavDef[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { id: "batches", label: "Batches", icon: Layers, href: "/batches" },
  { id: "all-items", label: "All items", icon: List, href: "/all-items" },
  { id: "loose-tray", label: "Loose tray", icon: Inbox, href: "/loose-tray" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const primaryItems: SidebarItem[] = PRIMARY_NAV.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    active: isActive(item.href, pathname),
    onClick: () => router.push(item.href),
  }));

  return (
    <Sidebar
      primaryItems={primaryItems}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
    />
  );
}
