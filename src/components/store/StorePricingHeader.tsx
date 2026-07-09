"use client";

import { useState } from "react";
import { Button, Tooltip } from "@dejesumensaje/converge-ds-experimental";
import { Settings2 } from "lucide-react";
import { StoreSwitcher } from "@/components/layout/StoreSwitcher";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { useActiveStore } from "@/store/pricing-store";

// Rendered as a fragment so the store switcher, address, gear button, and the
// sibling Batch-tray button are all direct flex children of the page header
// row. `order` + the address's `w-full md:w-auto` drive the responsive wrap:
//   mobile  → row 1: switcher · gear ⋯ batch tray (pinned right) / row 2: address
//   desktop → switcher · gear · address ⋯⋯⋯ batch tray (single row)
// The gear shares the switcher's `order-1` — ties resolve by source order, so
// it renders immediately after the switcher in both layouts.
export function StorePricingHeader() {
  const store = useActiveStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <StoreSwitcher />
      <div className="order-1">
        <Tooltip content="Store settings">
          <Button
            variant="tertiary"
            iconLeft={Settings2}
            aria-label="Store settings"
            onClick={() => setSettingsOpen(true)}
          />
        </Tooltip>
      </div>
      <div className="order-3 w-full md:order-2 md:w-auto">
        <span className="text-base text-gray-500 md:ml-1">{store.address}</span>
      </div>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
