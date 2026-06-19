import { RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard + focus management for the app's hand-rolled dropdown menus
 * (the DS has no Popover/DropdownMenu yet). On open, focus moves into the
 * panel; Arrow/Home/End roam the focusable items; Escape closes and restores
 * focus to the trigger (the element carrying `aria-haspopup`).
 */
export function useMenuNav(
  open: boolean,
  close: () => void,
  containerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    items?.[0]?.focus();
  }, [open, panelRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      containerRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      : [];
    if (items.length === 0) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
        ? items.length - 1
        : e.key === "ArrowDown"
        ? (idx + 1) % items.length
        : (idx - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return { onKeyDown };
}
