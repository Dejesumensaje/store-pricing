"use client";

import { Drawer, Button, Badge } from "@dejesumensaje/converge-ds-experimental";
import { ShieldCheck } from "lucide-react";
import { useActiveStore, usePricingStore, useEdlpException } from "@/store/pricing-store";
import { fmtDateTime } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Every settings area gets the same shape — a title, an optional status badge,
// and its content — so future sections slot in below without inventing new
// chrome.
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

/**
 * Store-level Settings drawer. Read-only: store context + the EDLP ceiling
 * exception AVP – Pricing may have granted this store. No editable settings
 * live here yet.
 */
export function SettingsDrawer({ open, onOpenChange }: Props) {
  const store = useActiveStore();
  const items = usePricingStore((s) => s.items);
  // Read-only — AVP – Pricing grants/revokes exceptions; there is no edit flow here.
  const edlpException = useEdlpException();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      size="md"
      className="max-md:!w-full"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">{store.name}</span>
          <span className="text-xs text-gray-500">{store.address}</span>
          <span className="text-xs text-gray-400">Store ID {store.id}</span>
        </div>

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
