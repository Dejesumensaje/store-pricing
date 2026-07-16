"use client";

import { useRef, useState } from "react";
import { usePricingStore } from "@/store/pricing-store";
import { computeWalkRows, useMobileSessionStore } from "@/store/mobile-session";
import { findItemByUpc } from "@/lib/mobile";
import { useIsMobile } from "./hooks/useIsMobile";
import { useMobileNav } from "./hooks/useMobileNav";
import { useBarcodeWedge } from "./hooks/useBarcodeWedge";
import { MobileHome } from "./MobileHome";
import { WaitingScreen } from "./WaitingScreen";
import { SimulateScanSheet } from "./SimulateScanSheet";
import { UpcEntryScreen } from "./UpcEntryScreen";
import { ItemScreen } from "./ItemScreen";
import { SessionTray } from "./SessionTray";
import { MaintenanceSuccess } from "./MaintenanceSuccess";

// Mounts at `/` under `max-md` only (see page.tsx's `md:hidden` wrapper).
// Gated here too, not just by CSS: `useIsMobile` decides whether the mobile
// subtree — and every global listener it wires (the barcode wedge,
// popstate) — is mounted at all, so nothing on desktop can be affected by
// them (see AGENTS.md / the plan's "window listeners aren't CSS-gated" trap).
export function MobileShell() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return <MobileShellInner />;
}

function MobileShellInner() {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const walkOrder = useMobileSessionStore((s) => s.walkOrder);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const { view, navigate } = useMobileNav();

  // The counter pill and the tray share computeWalkRows as the one definition
  // of "this walk's edits", so the pill can never advertise work the tray
  // won't show (e.g. after a cancelled fuel change).
  const sessionCount = computeWalkRows(items, overrides, walkOrder, walkEntries).length;

  const [simulateOpen, setSimulateOpen] = useState(false);
  const [upcEntryOpen, setUpcEntryOpen] = useState(false);
  const [unknownUpc, setUnknownUpc] = useState<string | null>(null);
  // Set by the currently-mounted ItemScreen to its own "commit valid drafts"
  // function — lets a hardware scan mid-edit autosave before jumping to the
  // next item, without lifting ItemScreen's draft state out of the component.
  const autoSaveRef = useRef<(() => void) | null>(null);

  // Shared resolver for every scan source — the real wedge, "Simulate scan",
  // and the "Enter UPC" fallback all funnel through this one UPC → item →
  // navigate path.
  const resolveScan = (upc: string) => {
    const item = findItemByUpc(items, upc);
    if (!item) {
      setUnknownUpc(upc);
      return;
    }
    setUnknownUpc(null);
    setSimulateOpen(false);
    setUpcEntryOpen(false);
    if (view.name === "walk-edit") {
      // Scanning while editing auto-saves a valid draft and opens the next
      // item — replaceState keeps the back stack shallow for a scan-scan-scan
      // rhythm (see the plan's Store Walk flow).
      autoSaveRef.current?.();
      navigate({ name: "walk-edit", itemId: item.id }, { replace: true });
    } else if (view.name === "walk-waiting" || view.name === "walk-tray" || view.name === "home") {
      navigate({ name: "walk-edit", itemId: item.id });
    } else if (view.name === "maint-waiting" || view.name === "maint-sent") {
      // A fresh scan starts a new maintenance change — reset the fuel
      // baseline to the item's current value so an earlier (already-sent)
      // fuel change doesn't read as changed again in the recap.
      useMobileSessionStore.getState().setMaintFuelBaseline(item.id, item.fuelSaver ?? null, { reset: true });
      navigate({ name: "maint-edit", itemId: item.id });
    }
    // maint-edit: mid-flow scans are ignored — Item
    // Maintenance is a deliberate single-item flow (the continuous-scan
    // autosave rhythm is a Store Walk behavior only, per the plan).
  };

  useBarcodeWedge(resolveScan, true);

  const scanSheets = (
    <>
      <SimulateScanSheet open={simulateOpen} items={items} onClose={() => setSimulateOpen(false)} onPick={resolveScan} />
      {upcEntryOpen && (
        <div className="fixed inset-0 z-40 bg-white">
          <UpcEntryScreen onSubmit={resolveScan} onCancel={() => setUpcEntryOpen(false)} />
        </div>
      )}
    </>
  );

  // Every navigation gets a quick fade + rise (screen-in) instead of a hard
  // cut — keyed so the animation replays per destination, including the same
  // screen for a different item.
  const screenKey = "itemId" in view ? `${view.name}:${view.itemId}` : view.name;
  return (
    <div key={screenKey} className="screen-in h-full">
      {renderView()}
    </div>
  );

  function renderView() {
  switch (view.name) {
    case "home":
      return (
        <MobileHome onStoreWalk={() => navigate({ name: "walk-waiting" })} onItemMaintenance={() => navigate({ name: "maint-waiting" })} />
      );

    case "walk-waiting":
      return (
        <>
          <WaitingScreen
            mode="walk"
            sessionCount={sessionCount}
            onOpenTray={() => navigate({ name: "walk-tray" })}
            onSimulateScan={() => setSimulateOpen(true)}
            onEnterUpc={() => setUpcEntryOpen(true)}
            onHome={() => navigate({ name: "home" })}
            unknownUpc={unknownUpc}
          />
          {scanSheets}
        </>
      );

    case "walk-edit":
      return (
        <ItemScreen
          key={view.itemId}
          itemId={view.itemId}
          mode="walk"
          autoSaveRef={autoSaveRef}
          // Post-save replaceState: back from the scanner must not re-enter
          // the just-saved item's editor.
          onDone={() => navigate({ name: "walk-waiting" }, { replace: true })}
          onCancel={() => navigate({ name: "walk-waiting" })}
        />
      );

    case "walk-tray":
      return (
        <SessionTray
          onEditItem={(id) => navigate({ name: "walk-edit", itemId: id })}
          onEndWalk={() => {
            useMobileSessionStore.getState().clear();
            navigate({ name: "home" });
          }}
          onBack={() => navigate({ name: "walk-waiting" })}
        />
      );

    case "maint-waiting":
      return (
        <>
          <WaitingScreen
            mode="maint"
            onSimulateScan={() => setSimulateOpen(true)}
            onEnterUpc={() => setUpcEntryOpen(true)}
            onHome={() => navigate({ name: "home" })}
            unknownUpc={unknownUpc}
          />
          {scanSheets}
        </>
      );

    case "maint-edit":
      return (
        <ItemScreen
          key={view.itemId}
          itemId={view.itemId}
          mode="maint"
          autoSaveRef={autoSaveRef}
          onDone={() => navigate({ name: "maint-sent", itemId: view.itemId })}
          onCancel={() => navigate({ name: "maint-waiting" })}
        />
      );

    case "maint-sent":
      return <MaintenanceSuccess itemId={view.itemId} onScanNext={() => navigate({ name: "maint-waiting" })} />;

    default:
      return null;
  }
  }
}
