"use client";

import { useState, useMemo } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  Button,
  Badge,
  Modal,
  Checkbox,
  Input,
  SearchInput,
  Select,
  Breadcrumb,
} from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { Override } from "@/types/pricing";
import { fmt } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";
import { Package, Send, Plus, Trash2, ChevronDown, ChevronRight, ArrowLeft, Inbox } from "lucide-react";

function toggleSetItem(prev: Set<string>, id: string, checked: boolean | "indeterminate"): Set<string> {
  const next = new Set(prev);
  checked === true ? next.add(id) : next.delete(id);
  return next;
}

// ─── Modal footer helper ──────────────────────────────────────────────────────
function ModalFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      {children}
    </div>
  );
}

// ─── Override row ────────────────────────────────────────────────────────────
function OverrideRow({
  override,
  selected,
  onSelect,
  onRemove,
  action,
}: {
  override: Override;
  selected: boolean;
  onSelect: (checked: boolean | "indeterminate") => void;
  onRemove: () => void;
  action?: React.ReactNode;
}) {
  const diff = override.newPrice - override.currentPrice;
  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${selected ? "bg-blue-50" : ""}`}>
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label="Select override" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{override.itemName}</p>
        <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[override.changeType] ?? override.changeType}</p>
      </div>
      <div className="flex items-center gap-5 shrink-0 text-sm">
        <div className="text-center w-16">
          <p className="text-[10px] text-gray-400 uppercase">Current</p>
          <p className="font-medium text-gray-600">{fmt(override.currentPrice)}</p>
        </div>
        <div className="text-center w-16">
          <p className="text-[10px] text-gray-400 uppercase">New</p>
          <p className="font-semibold text-gray-900">{fmt(override.newPrice)}</p>
        </div>
        <div className="text-center w-20">
          <p className="text-[10px] text-gray-400 uppercase">Change</p>
          <p className={`font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {diff >= 0 ? "+" : ""}{fmt(diff)}
          </p>
        </div>
      </div>
      {action}
      <Button variant="tertiary" size="sm" iconLeft={Trash2} onClick={onRemove} aria-label="Remove" />
    </div>
  );
}

// ─── Column header row ────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
      <div className="size-4 shrink-0" />
      <div className="flex-1">Item / Type</div>
      <div className="flex items-center gap-5 shrink-0">
        <span className="w-16 text-center">Current</span>
        <span className="w-16 text-center">New</span>
        <span className="w-20 text-center">Change</span>
      </div>
      <div className="w-24 shrink-0" />
      <div className="size-4 shrink-0" />
    </div>
  );
}

// ─── Batch section ────────────────────────────────────────────────────────────
function BatchSection({ batchId, selectedIds, onSelect }: {
  batchId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean | "indeterminate") => void;
}) {
  const { batches, overrides, submitBatch, removeFromBatch, removeFromLooseTray } = usePricingStore();
  const batch = batches.find((b) => b.id === batchId);
  const [expanded, setExpanded] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);

  if (!batch) return null;

  const batchOverrides = overrides.filter((o) => o.batchId === batchId);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white">
      <div className="flex items-center">
        <div
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none flex-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="size-4 text-gray-400 shrink-0" /> : <ChevronRight className="size-4 text-gray-400 shrink-0" />}
          <span className="font-semibold text-gray-800 text-sm flex-1">{batch.name}</span>
          <Badge tone={batch.status === "submitted" ? "success" : "neutral"} size="sm">
            {batch.status === "submitted" ? "Submitted" : "Draft"}
          </Badge>
          <span className="text-xs text-gray-400">{batchOverrides.length} item{batchOverrides.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="px-3 bg-gray-50 border-l border-gray-200 flex items-center self-stretch">
          <Button size="sm" variant="secondary" iconLeft={Send} onClick={() => setSubmitOpen(true)}
            disabled={batch.status === "submitted"}>
            Submit batch
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          {batchOverrides.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
              <Inbox className="size-6 stroke-1" />
              <p className="text-sm">No items yet</p>
            </div>
          ) : (
            <>
              <TableHeader />
              {batchOverrides.map((ov) => (
                <OverrideRow
                  key={ov.id}
                  override={ov}
                  selected={selectedIds.has(ov.id)}
                  onSelect={(c) => onSelect(ov.id, c)}
                  onRemove={() => removeFromLooseTray(ov.id)}
                  action={
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconLeft={ArrowLeft}
                      onClick={() => removeFromBatch(ov.id)}
                    >
                      Move to pending
                    </Button>
                  }
                />
              ))}
            </>
          )}
        </>
      )}

      <Modal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title={`Submit: ${batch.name}`}
        size="md"
        footer={
          <ModalFooter onCancel={() => setSubmitOpen(false)}>
            <Button variant="primary" iconLeft={Send} onClick={() => { submitBatch(batchId); setSubmitOpen(false); }}>
              Submit to SAP
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          You are about to send <strong>{batchOverrides.length} price change{batchOverrides.length !== 1 ? "s" : ""}</strong> from batch <strong>{batch.name}</strong> to SAP.
        </p>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {batchOverrides.map((ov) => (
            <div key={ov.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{ov.itemName}</p>
                <p className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                <span className="text-gray-300">→</span>
                <span className="font-semibold text-gray-900">{fmt(ov.newPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LooseTrayPage() {
  const { overrides, batches, removeFromLooseTray, createBatch, addToBatch, submitAll } = usePricingStore();

  const pendingOverrides = overrides.filter((o) => o.status === "pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Modals
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [sendAllOpen, setSendAllOpen] = useState(false);
  const [addToBatchOpen, setAddToBatchOpen] = useState(false);

  // New batch form
  const [batchName, setBatchName] = useState("");
  const [batchItemSearch, setBatchItemSearch] = useState("");
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());

  // Add to existing batch form
  const [targetBatchId, setTargetBatchId] = useState("");

  const draftBatches = batches.filter((b) => b.status === "draft");

  const toggleSelect = (id: string, checked: boolean | "indeterminate") => {
    setSelectedIds((prev) => toggleSetItem(prev, id, checked));
  };

  const toggleBatchItem = (id: string, checked: boolean | "indeterminate") => {
    setBatchSelectedIds((prev) => toggleSetItem(prev, id, checked));
  };

  // Filter pending overrides by search
  const filteredPending = useMemo(() => {
    if (!search.trim()) return pendingOverrides;
    const q = search.toLowerCase();
    return pendingOverrides.filter(
      (o) =>
        o.itemName.toLowerCase().includes(q) ||
        CATEGORY_LABELS[o.changeType]?.toLowerCase().includes(q)
    );
  }, [pendingOverrides, search]);

  // Items available to add to a batch (pending)
  const batchCandidates = useMemo(() => {
    if (!batchItemSearch.trim()) return pendingOverrides;
    const q = batchItemSearch.toLowerCase();
    return pendingOverrides.filter((o) => o.itemName.toLowerCase().includes(q));
  }, [pendingOverrides, batchItemSearch]);

  const handleCreateBatch = () => {
    if (!batchName.trim() || batchSelectedIds.size === 0) return;
    createBatch(batchName.trim(), Array.from(batchSelectedIds));
    setBatchName("");
    setBatchSelectedIds(new Set());
    setBatchItemSearch("");
    setNewBatchOpen(false);
    setSelectedIds(new Set());
  };

  const handleAddToBatch = () => {
    if (!targetBatchId || selectedIds.size === 0) return;
    addToBatch(targetBatchId, Array.from(selectedIds));
    setSelectedIds(new Set());
    setAddToBatchOpen(false);
    setTargetBatchId("");
  };

  const batchSelectOptions = draftBatches.map((b) => ({ label: b.name, value: b.id }));

  const allOverrides = overrides.filter((o) => o.status !== "submitted");
  const pendingCount = overrides.filter((o) => o.status === "pending").length;
  const batchedCount = overrides.filter((o) => o.status === "in_batch").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader alertCount={pendingOverrides.length} />

      <div className="px-6 pt-4 pb-2 shrink-0">
        <Breadcrumb
          variant="trail"
          items={[{ label: "Store Pricing", href: "/" }, { label: "Loose Tray" }]}
        />
      </div>

      <main className="flex-1 px-6 pb-8 max-w-[1100px] mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">Loose Tray</h1>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && draftBatches.length > 0 && (
              <Button variant="secondary" size="sm" iconLeft={Plus} onClick={() => setAddToBatchOpen(true)}>
                Add to batch ({selectedIds.size})
              </Button>
            )}
            <Button variant="secondary" size="sm" iconLeft={Plus} onClick={() => {
              setBatchSelectedIds(new Set(selectedIds));
              setNewBatchOpen(true);
            }}>
              New batch{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button variant="primary" size="sm" iconLeft={Send} onClick={() => setSendAllOpen(true)}>
              Send all to SAP
            </Button>
          </div>
        </div>

        {/* ── Pending changes ─────────────────────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Pending changes</h2>
              {pendingOverrides.length > 0 && <Badge tone="warning" size="sm">{pendingOverrides.length}</Badge>}
            </div>
            {pendingOverrides.length > 0 && (
              <SearchInput
                value={search}
                onValueChange={setSearch}
                aria-label="Search pending items"
                className="w-64"
              />
            )}
          </div>

          {pendingOverrides.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-14 flex flex-col items-center gap-3 text-gray-400">
              <Package className="size-10 stroke-1" />
              <p className="text-sm">No pending changes</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <TableHeader />
              {filteredPending.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-4 text-center">No items match your search.</p>
              ) : (
                filteredPending.map((ov) => (
                  <OverrideRow
                    key={ov.id}
                    override={ov}
                    selected={selectedIds.has(ov.id)}
                    onSelect={(c) => toggleSelect(ov.id, c)}
                    onRemove={() => { removeFromLooseTray(ov.id); setSelectedIds((p) => { const n = new Set(p); n.delete(ov.id); return n; }); }}
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* ── Batches ──────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Batches</h2>
            {batches.length > 0 && <Badge tone="neutral" size="sm">{batches.length}</Badge>}
          </div>

          {batches.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-14 flex flex-col items-center gap-3 text-gray-400">
              <Package className="size-10 stroke-1" />
              <p className="text-sm font-medium">No pending batches</p>
              <p className="text-xs text-center max-w-xs">Create a batch to group price changes for bulk submission.</p>
            </div>
          ) : (
            batches.map((b) => (
              <BatchSection key={b.id} batchId={b.id} selectedIds={selectedIds} onSelect={toggleSelect} />
            ))
          )}
        </section>
      </main>

      {/* ── New batch modal ─────────────────────────────────────────────────── */}
      <Modal
        open={newBatchOpen}
        onOpenChange={(open) => { setNewBatchOpen(open); if (!open) { setBatchName(""); setBatchSelectedIds(new Set()); setBatchItemSearch(""); } }}
        title="New batch"
        size="md"
        footer={
          <ModalFooter onCancel={() => setNewBatchOpen(false)}>
            <Button
              variant="primary"
              onClick={handleCreateBatch}
              disabled={!batchName.trim() || batchSelectedIds.size === 0}
            >
              Create batch ({batchSelectedIds.size} items)
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Batch name"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. Tuesday, ad prep"
            onKeyDown={(e) => e.key === "Enter" && handleCreateBatch()}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Select items to include</p>
            <SearchInput
              value={batchItemSearch}
              onValueChange={setBatchItemSearch}
              aria-label="Search items for batch"
              className="mb-2 w-full"
            />
            {pendingOverrides.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No pending items available.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {batchCandidates.map((ov) => (
                  <label
                    key={ov.id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${batchSelectedIds.has(ov.id) ? "bg-blue-50" : ""}`}
                  >
                    <Checkbox
                      checked={batchSelectedIds.has(ov.id)}
                      onCheckedChange={(c) => toggleBatchItem(ov.id, c)}
                      aria-label={ov.itemName}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ov.itemName}</p>
                      <p className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-semibold text-gray-700">{fmt(ov.newPrice)}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {batchSelectedIds.size > 0 && (
              <p className="text-xs text-blue-600 mt-2">{batchSelectedIds.size} item{batchSelectedIds.size !== 1 ? "s" : ""} selected</p>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Add to existing batch modal ─────────────────────────────────────── */}
      <Modal
        open={addToBatchOpen}
        onOpenChange={setAddToBatchOpen}
        title="Add to existing batch"
        size="sm"
        footer={
          <ModalFooter onCancel={() => setAddToBatchOpen(false)}>
            <Button variant="primary" onClick={handleAddToBatch} disabled={!targetBatchId}>
              Add {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">Choose which batch to add the {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""} to:</p>
          <Select
            label="Select batch"
            options={batchSelectOptions}
            value={targetBatchId}
            onChange={(v) => setTargetBatchId(v as string)}
            placeholder="Choose a batch..."
          />
        </div>
      </Modal>

      {/* ── Send all modal ──────────────────────────────────────────────────── */}
      <Modal
        open={sendAllOpen}
        onOpenChange={setSendAllOpen}
        title={`Send all ${allOverrides.length} prices to SAP${batchedCount > 0 ? ` — including ${batchedCount} batched` : ""}`}
        size="md"
        footer={
          <ModalFooter onCancel={() => setSendAllOpen(false)}>
            <Button variant="primary" iconLeft={Send} onClick={() => { submitAll(); setSendAllOpen(false); }}>
              Submit all
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          You are about to send <strong>{allOverrides.length} price change{allOverrides.length !== 1 ? "s" : ""}</strong> to SAP
          {pendingCount > 0 && batchedCount > 0 && (
            <> (<strong>{pendingCount} pending</strong> + <strong>{batchedCount} batched</strong>)</>
          )}
          . Review carefully before confirming.
        </p>
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          {allOverrides.map((ov) => (
            <div key={ov.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{ov.itemName}</p>
                <p className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                <span className="text-gray-300">→</span>
                <span className="font-semibold text-gray-900">{fmt(ov.newPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
