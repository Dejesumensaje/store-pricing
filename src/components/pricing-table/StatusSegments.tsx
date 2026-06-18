"use client";

import { Button } from "@dejesumensaje/converge-ds-experimental";
import { LucideIcon, PackagePlus, Pencil, AlertCircle, Send } from "lucide-react";

export type StatusSegmentKey = "new_from_hq" | "overrides" | "alerts" | "pending_send";

export type StatusSegment = {
  key: StatusSegmentKey;
  label: string;
  count: number;
  icon: LucideIcon;
};

export const SEGMENT_ICONS: Record<StatusSegmentKey, LucideIcon> = {
  new_from_hq: PackagePlus,
  overrides: Pencil,
  alerts: AlertCircle,
  pending_send: Send,
};

type Props = {
  segments: StatusSegment[];
  active: StatusSegmentKey | null;
  onChange: (key: StatusSegmentKey | null) => void;
};

export function StatusSegments({ segments, active, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {segments.map((seg) => {
        const Icon = seg.icon;
        const isActive = active === seg.key;
        return (
          <Button
            key={seg.key}
            variant={isActive ? "primary" : "secondary"}
            iconLeft={Icon}
            onClick={() => onChange(isActive ? null : seg.key)}
            aria-pressed={isActive}
          >
            <span className="font-semibold">{seg.count}</span>
            <span>{seg.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
