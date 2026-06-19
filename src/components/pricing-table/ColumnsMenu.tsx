"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, Checkbox } from "@dejesumensaje/converge-ds-experimental";
import { Columns3 } from "lucide-react";
import { useMenuNav } from "../shared/useMenuNav";

export type ColumnOption = { id: string; label: string; visible: boolean };

// The DS has no Popover/DropdownMenu yet, so this is a minimal headless popover:
// click-outside closes it; useMenuNav handles focus-in, arrow roaming, Escape
// + focus restore. It's a settings group of checkboxes (role="group"), not a
// command menu.
export function ColumnsMenu({
  options,
  onToggle,
}: {
  options: ColumnOption[];
  onToggle: (id: string, visible: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const { onKeyDown } = useMenuNav(open, () => setOpen(false), ref, panelRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="tertiary"
        size="sm"
        iconLeft={Columns3}
        aria-label="Column settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-labelledby={labelId}
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
        >
          <p id={labelId} className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Optional columns
          </p>
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
              >
                <Checkbox
                  checked={o.visible}
                  onCheckedChange={(v) => onToggle(o.id, v === true)}
                  aria-label={o.label}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
