"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, Button, Badge } from "@dejesumensaje/converge-ds-experimental";
import { ChevronUp, ChevronDown, RotateCcw, ShieldCheck } from "lucide-react";
import { useActiveStore, usePricingStore, useCompetitorOrder, useEdlpException } from "@/store/pricing-store";
import { HQ_DEFAULT_ORDER } from "@/lib/competitors";
import { fmtDateTime } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Every settings area gets the same shape — a title, an optional status badge,
// and its content — so future sections (beyond competitor order) slot in below
// without inventing new chrome.
function SettingsSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

const titleCase = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((k, i) => k === b[i]);

// Build the reorderable universe for a given ranking: the ranked names first
// (in rank order), then every other known competitor name, alphabetically.
function fullOrder(ranked: string[], universe: Map<string, string>): string[] {
  const known = ranked.filter((k) => universe.has(k));
  const rest = [...universe.keys()]
    .filter((k) => !known.includes(k))
    .sort((a, b) => universe.get(a)!.localeCompare(universe.get(b)!));
  return [...known, ...rest];
}

// Shortest prefix of `order` that fullOrder() expands back into `order`.
// Everything after that prefix is just the alphabetical fill the director never
// touched — persisting it would rank those competitors and stop
// orderCompetitors from falling back to distance for them, so we drop it.
function trimAlphabeticalTail(order: string[], universe: Map<string, string>): string[] {
  let end = order.length;
  while (end > 0 && sameOrder(fullOrder(order.slice(0, end - 1), universe), order)) end--;
  return order.slice(0, end);
}

/**
 * Store-level Settings drawer. First (and so far only) section lets the
 * director override HQ's Walmart-then-Aldi competitor price order for the
 * active store — everything else in the drawer (store context, section
 * layout) is built to make room for future settings sections.
 */
export function SettingsDrawer({ open, onOpenChange }: Props) {
  const store = useActiveStore();
  const items = usePricingStore((s) => s.items);
  const override = useCompetitorOrder();
  const setCompetitorOrder = usePricingStore((s) => s.setCompetitorOrder);
  const resetCompetitorOrder = usePricingStore((s) => s.resetCompetitorOrder);
  // Read-only — AVP – Pricing grants/revokes exceptions; there is no edit flow here.
  const edlpException = useEdlpException();

  // Name universe = HQ's two defaults (capitalized) plus every competitor name
  // this store's items actually carry, deduped case-insensitively (first
  // casing found in the data wins).
  const universe = useMemo(() => {
    const labelByKey = new Map<string, string>();
    for (const key of HQ_DEFAULT_ORDER) labelByKey.set(key, titleCase(key));
    for (const item of items) {
      for (const c of item.competitors ?? []) {
        const key = c.name.trim().toLowerCase();
        if (!labelByKey.has(key)) labelByKey.set(key, c.name.trim());
      }
    }
    return labelByKey;
  }, [items]);

  const hqOrder = useMemo(() => fullOrder(HQ_DEFAULT_ORDER, universe), [universe]);
  const appliedOrder = useMemo(
    () => (override ? fullOrder(override, universe) : hqOrder),
    [override, universe, hqOrder]
  );

  const [draft, setDraft] = useState<string[]>(appliedOrder);

  // Re-seed the draft whenever the drawer opens (or the active store changes
  // while it's closed) — edits never leak from a previous session or store.
  useEffect(() => {
    if (open) setDraft(appliedOrder);
    // appliedOrder is intentionally excluded: it changes on every keystroke of
    // an in-progress edit (via setCompetitorOrder elsewhere), and re-seeding
    // then would clobber unsaved reordering. Only re-seed on open/store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, store.id]);

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const isDirty = !sameOrder(draft, appliedOrder);
  // The badge tracks the draft, not the saved state: the moment the director
  // deviates from HQ's order it reads "Custom", even before hitting Save.
  const isHqDraft = sameOrder(draft, hqOrder);

  const handleSave = () => {
    // Persist only the ranked prefix, not the padded universe: names left in
    // the alphabetical tail stay unranked, so items keep distance-sorting them.
    if (sameOrder(draft, hqOrder)) resetCompetitorOrder(store.id);
    else setCompetitorOrder(store.id, trimAlphabeticalTail(draft, universe));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraft(appliedOrder);
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
      title="Settings"
      size="md"
      className="max-md:!w-full"
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!isDirty} onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">{store.name}</span>
          <span className="text-xs text-gray-500">{store.address}</span>
          <span className="text-xs text-gray-400">Store ID {store.id}</span>
        </div>

        <SettingsSection
          title="Competitor price order"
          badge={
            <Badge tone={isHqDraft ? "neutral" : "in-progress"} size="sm">
              {isHqDraft ? "HQ default" : "Custom"}
            </Badge>
          }
        >
          <ol className="flex flex-col gap-1.5">
            {draft.map((key, i) => {
              const label = universe.get(key) ?? titleCase(key);
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums text-gray-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-gray-800">{label}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconLeft={ChevronUp}
                      aria-label={`Move ${label} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    />
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconLeft={ChevronDown}
                      aria-label={`Move ${label} down`}
                      disabled={i === draft.length - 1}
                      onClick={() => move(i, 1)}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="text-xs text-gray-500">
            Your ranking applies down to the last competitor you reorder — everything below it
            stays sorted by distance. Applies to {store.name} only.
          </p>

          <div>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RotateCcw}
              disabled={isHqDraft}
              onClick={() => setDraft(hqOrder)}
            >
              Reset to HQ default
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          title="EDLP exceptions"
          badge={
            edlpException ? (
              <Badge tone="warning" size="sm">Active</Badge>
            ) : (
              <Badge tone="neutral" size="sm">None</Badge>
            )
          }
        >
          {edlpException ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <ShieldCheck className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                {edlpException.scope === "store"
                  ? "Store-wide exception"
                  : `${edlpException.scope.length} item exception${edlpException.scope.length === 1 ? "" : "s"}`}
              </span>
              {edlpException.scope !== "store" && (
                <p className="text-xs text-gray-700">
                  {edlpException.scope
                    .map((id) => items.find((i) => i.id === id)?.name ?? id)
                    .join(", ")}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Approved by {edlpException.approvedBy} · {fmtDateTime(edlpException.grantedAt)}
              </p>
              {edlpException.note && (
                <p className="text-xs italic text-gray-600">“{edlpException.note}”</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No active exception for {store.name}. EDLP items are hard-capped at 10% over the SAP
              PMR maximum.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Granted by AVP – Pricing, downgrading the hard stop to a visible warning. View only —
            not editable here.
          </p>
        </SettingsSection>
      </div>
    </Drawer>
  );
}
