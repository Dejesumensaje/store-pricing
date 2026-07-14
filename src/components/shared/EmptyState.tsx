import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Optional action (e.g. a "Clear filters" button) shown below the hint. */
  action?: React.ReactNode;
  /** Dashed bordered card (default) vs. plain inline (e.g. inside a drawer). */
  bordered?: boolean;
  /** Override vertical padding (defaults to py-14). */
  className?: string;
};

// One empty-state recipe shared by every surface that can come up empty (items
// table, review worklist) so they stay visually consistent.
export function EmptyState({ icon: Icon, title, hint, action, bordered = true, className }: Props) {
  return (
    <div
      className={`flex flex-col items-center gap-2 text-gray-500 ${
        bordered ? "rounded-xl border border-dashed border-gray-200 bg-white py-14" : "py-16"
      } ${className ?? ""}`}
    >
      <Icon className="size-9 stroke-[1.5]" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs text-center text-xs">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
