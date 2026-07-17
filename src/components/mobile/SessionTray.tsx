"use client";

import { useState } from "react";
import { ChevronLeft, Link2, Trash2 } from "lucide-react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { computeWalkRows, useMobileSessionStore, type WalkRow } from "@/store/mobile-session";
import { MoveLine } from "@/components/store/buildStoreColumns";
import { FuelMoveLine } from "./FuelMove";
import { fmtQtyPrice } from "@/lib/format";

type Props = {
  onEditItem: (itemId: string) => void;
  onEndWalk: () => void;
  onBack: () => void;
};

// Line-priced families arrive as many near-identical rows (the 22-member
// center-store band, e.g.); past this many we collapse to a peek so the tray
// stays scannable. Same threshold as the desktop broken-ladder summary.
const FAMILY_WINDOW = 8;

// The stacked shelf-tag lines for one edited item — base = white tag, retail =
// yellow promo tag, fuel = blue chip. Shared by standalone rows and the
// members inside a family block so both read in the same grammar.
function MoveLines({ row }: { row: WalkRow }) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {row.baseOverride && (
        <MoveLine
          label="Base"
          original={row.baseOverride.currentPrice}
          display={fmtQtyPrice(row.item.newBaseQty, row.item.newBasePrice ?? row.item.currentBasePrice)}
          tag="white"
        />
      )}
      {row.retailOverride && (
        <MoveLine
          label="Retail"
          original={row.retailOverride.currentPrice}
          display={fmtQtyPrice(row.item.newRetailQty, row.item.newRetailPrice ?? row.item.currentBasePrice)}
          tag="yellow"
        />
      )}
      <FuelMoveLine label="Fuel" from={row.fuelBaseline} to={row.item.fuelSaver ?? null} changed={row.fuelChanged} />
    </div>
  );
}

// Full-screen sheet: THIS session's edits only — computeWalkRows scopes each
// row to the sections actually edited this walk, so pre-seeded mockOverrides
// on other sections of a touched item never show up here (and can't be
// discarded from here). Fuel has no Override record, so its old→new comes
// from the session baseline snapshot; base/retail reuse the pending
// Override's `currentPrice`.
export function SessionTray({ onEditItem, onEndWalk, onBack }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const walkOrder = useMobileSessionStore((s) => s.walkOrder);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const untouch = useMobileSessionStore((s) => s.untouch);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = computeWalkRows(items, overrides, walkOrder, walkEntries);

  // Line-priced members enter the walk as their own rows (see
  // ItemScreen.commitDrafts). They share ONE price and move together, so the
  // tray groups them: a family becomes one block placed where it first
  // appears, with N member rows beneath a caption. Standalone items render
  // one card each, as before.
  const byFamily = new Map<string, WalkRow[]>();
  for (const r of rows) {
    if (!r.item.familyId) continue;
    const arr = byFamily.get(r.item.familyId) ?? [];
    arr.push(r);
    byFamily.set(r.item.familyId, arr);
  }
  type Block = { kind: "single"; row: WalkRow } | { kind: "family"; familyId: string; rows: WalkRow[] };
  const blocks: Block[] = [];
  const seenFamily = new Set<string>();
  for (const r of rows) {
    const fid = r.item.familyId;
    const group = fid ? byFamily.get(fid) : undefined;
    if (fid && group && group.length > 1) {
      if (seenFamily.has(fid)) continue;
      seenFamily.add(fid);
      blocks.push({ kind: "family", familyId: fid, rows: group });
    } else {
      blocks.push({ kind: "single", row: r });
    }
  }

  // Reverts ONLY the sections this session edited, reusing desktop's own
  // revert semantics: base via the family-aware clear, retail via
  // removeFromLooseTray (which also undoes the TA auto-conversion), fuel back
  // to the session baseline.
  const discardRow = (row: WalkRow) => {
    if (row.baseOverride) updateBasePrice(row.item.id, null);
    if (row.retailOverride) removeFromLooseTray(`${row.item.id}:retail`);
    if (row.fuelChanged) updateFuelSaver(row.item.id, row.fuelBaseline ?? null);
    untouch(row.item.id);
  };

  // A family shares one base price, so reverting any member reverts them all
  // (updateBasePrice is family-aware). Untouch every member so the whole block
  // leaves the walk together — no orphan rows left behind.
  const discardFamily = (group: WalkRow[]) => {
    const withBase = group.find((r) => r.baseOverride);
    if (withBase) updateBasePrice(withBase.item.id, null);
    for (const r of group) {
      if (r.retailOverride) removeFromLooseTray(`${r.item.id}:retail`);
      if (r.fuelChanged) updateFuelSaver(r.item.id, r.fuelBaseline ?? null);
      untouch(r.item.id);
    }
  };

  const toggle = (fid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center border-b border-gray-100 px-2 py-1.5">
        <div className="flex flex-1 justify-start">
          <button
            onClick={onBack}
            className="-ml-1 flex min-h-11 select-none touch-manipulation items-center gap-0.5 rounded-lg pl-1 pr-2.5 text-sm font-medium text-gray-500 active:bg-gray-100"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            Back
          </button>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">
          Session — {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
        <span className="flex-1" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {rows.length === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-600">No edits yet this walk.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((block) =>
              block.kind === "single" ? (
                <li key={block.row.item.id}>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <button onClick={() => onEditItem(block.row.item.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-gray-900">{block.row.item.name}</p>
                      <MoveLines row={block.row} />
                    </button>
                    <button
                      onClick={() => discardRow(block.row)}
                      aria-label={`Discard changes to ${block.row.item.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ) : (
                <li key={block.familyId}>
                  {/* One shared price rippled across the family — grouped so N
                      near-identical rows stay legible, discarded as one because
                      they move as one. */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Link2 className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {block.rows[0].item.priceFamilyName ?? "Line pricing"} · {block.rows.length} items
                      </span>
                      <button
                        onClick={() => discardFamily(block.rows)}
                        aria-label={`Discard the ${block.rows[0].item.priceFamilyName ?? "line-priced"} family`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <ul className="flex flex-col divide-y divide-gray-100">
                      {(expanded.has(block.familyId) ? block.rows : block.rows.slice(0, FAMILY_WINDOW)).map((row) => (
                        <li key={row.item.id}>
                          <button onClick={() => onEditItem(row.item.id)} className="w-full py-1.5 text-left">
                            <p className="truncate text-sm font-medium text-gray-900">{row.item.name}</p>
                            <MoveLines row={row} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {block.rows.length > FAMILY_WINDOW && (
                      <button
                        onClick={() => toggle(block.familyId)}
                        className="mt-2 min-h-9 select-none touch-manipulation text-xs font-medium text-brand active:opacity-70"
                      >
                        {expanded.has(block.familyId) ? "Show fewer" : `Show all ${block.rows.length} items`}
                      </button>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        {/* Two explicit lines rather than relying on the label to wrap — the
            full sentence doesn't fit on one line at 360px. */}
        <Button variant="primary" className="h-auto min-h-14 w-full flex-col gap-0 whitespace-normal py-2 leading-tight" onClick={onEndWalk}>
          <span>End walk</span>
          <span className="text-xs font-normal opacity-90">
            {rows.length} change{rows.length === 1 ? "" : "s"} pending desktop review
          </span>
        </Button>
      </div>
    </div>
  );
}
