"use client";

import { useEffect, useState } from "react";
import { Modal, Button, Badge, Input } from "@dejesumensaje/converge-ds-experimental";
import { Plus, Trash2 } from "lucide-react";
import { CompetitorPrice, PricingItem } from "@/types/pricing";
import { useGuardedActions } from "../shared/useGuardedActions";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { orderCompetitors, competitorIndex } from "@/lib/competitors";
import { fmt } from "@/lib/format";
import { PriceInputCell } from "./PriceInputCell";

type Props = {
  open: boolean;
  item: PricingItem;
  /** Per-unit base price to compare against — computed once by the caller (see CompetitorPrices). */
  ourBase: number;
  onClose: () => void;
  onSave: (competitors: CompetitorPrice[]) => void;
};

// Desktop: fixed 5-column grid. Below md it's hidden in favor of a stacked
// card layout (rendered per-row alongside it, toggled via md:hidden) — the
// same md: breakpoint ProductRelationships and PriceInputCell already use for
// this kind of density trade-off, so narrow viewports (e.g. mobile Safari)
// never see the crushed grid.
const GRID = "hidden md:grid md:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_2.5rem_2rem] items-center gap-2";
const FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-gray-400";

type AddForm = { name: string; address: string; price: string };
const EMPTY_ADD_FORM: AddForm = { name: "", address: "", price: "" };

// Edit modal for the drawer's Competitor prices section: manual price
// corrections on assembly-sourced rows, a competitor index vs. our base, and
// add/remove for director-added rows. Everything here is a local draft — only
// Save commits it to the store (see CompetitorPrices, which owns `open`).
export function CompetitorPricesModal({ open, item, ourBase, onClose, onSave }: Props) {
  const guarded = useGuardedActions(open);
  const [draft, setDraft] = useState<CompetitorPrice[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompetitorPrice | null>(null);

  // Re-seed the draft from the item's committed competitors every time the
  // modal opens — Cancel (or dismiss) simply never calls onSave, so nothing
  // needs to be undone.
  useEffect(() => {
    if (!open) return;
    setDraft(orderCompetitors(item.competitors ?? []));
    setShowAddForm(false);
    setAddForm(EMPTY_ADD_FORM);
    setAddError(null);
    setPendingDelete(null);
  }, [open, item]);

  const updateRow = (name: string, patch: Partial<CompetitorPrice>) => {
    setDraft((rows) => rows.map((r) => (r.name === name ? { ...r, ...patch } : r)));
  };

  const confirmAdd = () => {
    const name = addForm.name.trim();
    const address = addForm.address.trim();
    const price = parseFloat(addForm.price);
    if (!name) return setAddError("Enter a competitor name.");
    if (draft.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      return setAddError(`"${name}" is already in this list.`);
    }
    if (!address) return setAddError("Enter an address.");
    if (!(price > 0)) return setAddError("Enter a price greater than $0.");
    setDraft((rows) => [...rows, { name, address, price, source: "user" }]);
    setShowAddForm(false);
    setAddForm(EMPTY_ADD_FORM);
    setAddError(null);
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setAddForm(EMPTY_ADD_FORM);
    setAddError(null);
  };

  const handleSave = () => {
    // manualPrice equal to the assembly price is not a correction — drop it
    // rather than carry a no-op override forward.
    const cleaned = draft.map((r) =>
      r.manualPrice != null && r.manualPrice === r.price ? { ...r, manualPrice: undefined } : r
    );
    onSave(cleaned);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        title="Competitor prices"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={guarded(onClose)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={showAddForm} onClick={guarded(handleSave)}>
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-500">Our base price</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(ourBase)}</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className={`${GRID} bg-gray-50 px-3 py-1.5 border-b border-gray-100`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Competitor</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Price</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Manual price</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Index</span>
              <span />
            </div>

            {draft.length === 0 && !showAddForm && (
              <p className="px-3 py-4 text-center text-sm text-gray-500">No competitors yet.</p>
            )}

            {draft.map((c) => {
              const index = competitorIndex(c, ourBase);
              const meta =
                c.source === "user"
                  ? c.address ?? null
                  : [c.distanceMi != null ? `${c.distanceMi} mi` : null, c.address ?? null]
                      .filter(Boolean)
                      .join(" · ") || null;
              const nameBlock = (
                <div className="min-w-0">
                  <p className="break-words text-sm text-gray-700">{c.name}</p>
                  {c.source === "user" && (
                    <Badge tone="neutral" size="sm">Added by you</Badge>
                  )}
                  {meta && <p className="break-words text-xs text-gray-500">{meta}</p>}
                </div>
              );
              const priceCell =
                c.source === "user" ? (
                  <PriceInputCell
                    recommended={c.price}
                    value={c.price}
                    state="edited"
                    ariaLabel={`Price for ${c.name}`}
                    onCommit={(v) => updateRow(c.name, { price: v ?? c.price })}
                  />
                ) : (
                  <span className="text-sm tabular-nums text-gray-700">{fmt(c.price)}</span>
                );
              const manualPriceCell =
                c.source === "assembly" ? (
                  <PriceInputCell
                    recommended={c.price}
                    value={c.manualPrice ?? null}
                    state={c.manualPrice != null ? "edited" : "untouched"}
                    ariaLabel={`Manual price for ${c.name}`}
                    onCommit={(v) => updateRow(c.name, { manualPrice: v ?? undefined })}
                  />
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                );
              const deleteButton = c.source === "user" && (
                <Button
                  variant="tertiary"
                  size="sm"
                  iconLeft={Trash2}
                  aria-label={`Remove ${c.name}`}
                  onClick={() => setPendingDelete(c)}
                />
              );

              return (
                <div key={c.name}>
                  {/* Desktop: fixed 5-column grid row. */}
                  <div className={`${GRID} px-3 py-2 border-b border-gray-100 last:border-0`}>
                    {nameBlock}
                    <div className="text-right">{priceCell}</div>
                    <div className="text-right">{manualPriceCell}</div>
                    <span className="text-right text-xs tabular-nums text-gray-500">
                      {index != null ? index.toFixed(2) : "—"}
                    </span>
                    <div className="flex justify-end">{deleteButton}</div>
                  </div>

                  {/* Mobile: stacked card — name/meta on top, then labeled
                      price / manual price / index rows. Avoids crushing the
                      fixed grid's flexible name column on narrow viewports. */}
                  <div className="md:hidden flex flex-col gap-2 px-3 py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      {nameBlock}
                      {deleteButton}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <div className="flex flex-col gap-1">
                        <span className={FIELD_LABEL}>Price</span>
                        {priceCell}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={FIELD_LABEL}>Manual price</span>
                        {manualPriceCell}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={FIELD_LABEL}>Index</span>
                        <span className="text-xs tabular-nums text-gray-500">
                          {index != null ? index.toFixed(2) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {showAddForm ? (
              <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-3 py-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="required-input">
                    <Input
                      label="Name"
                      size="sm"
                      value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="required-input">
                    <Input
                      label="Address"
                      size="sm"
                      value={addForm.address}
                      onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="required-input">
                    <Input
                      label="Price ($)"
                      size="sm"
                      inputMode="decimal"
                      value={addForm.price}
                      onChange={(e) => {
                        if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setAddForm((f) => ({ ...f, price: e.target.value }));
                      }}
                    />
                  </div>
                </div>
                {addError && <p className="text-xs text-red-600">{addError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="tertiary" size="sm" onClick={cancelAdd}>
                    Cancel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={confirmAdd}>
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-100 px-3 py-2">
                <Button variant="tertiary" size="sm" iconLeft={Plus} onClick={() => setShowAddForm(true)}>
                  Add competitor
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        headline={pendingDelete ? `Remove ${pendingDelete.name}?` : ""}
        description="This removes it from the list — Save to make it permanent."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          setDraft((rows) => rows.filter((r) => r.name !== pendingDelete.name));
        }}
      />
    </>
  );
}
