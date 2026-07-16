"use client";

import { useCallback, useEffect, useState } from "react";

// The mobile view machine, encoded entirely in the URL hash (`#m/...`) so
// Android hardware back = previous view and a refresh restores the current
// view — see AGENTS.md's Next 16 "Native History API" pattern. Empty hash =
// home.
export type MobileView =
  | { name: "home" }
  | { name: "walk-waiting" }
  | { name: "walk-edit"; itemId: string }
  | { name: "walk-review"; itemId: string }
  | { name: "walk-tray" }
  | { name: "maint-waiting" }
  | { name: "maint-edit"; itemId: string }
  | { name: "maint-review"; itemId: string }
  | { name: "maint-sent"; itemId: string };

function parseHash(hash: string): MobileView {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  const [root, mode, action, id] = parts;
  if (root !== "m") return { name: "home" };
  if (mode === "walk") {
    if (action === "edit" && id) return { name: "walk-edit", itemId: id };
    if (action === "review" && id) return { name: "walk-review", itemId: id };
    if (action === "tray") return { name: "walk-tray" };
    return { name: "walk-waiting" };
  }
  if (mode === "maint") {
    if (action === "edit" && id) return { name: "maint-edit", itemId: id };
    if (action === "review" && id) return { name: "maint-review", itemId: id };
    if (action === "sent" && id) return { name: "maint-sent", itemId: id };
    return { name: "maint-waiting" };
  }
  return { name: "home" };
}

function hashFor(view: MobileView): string {
  switch (view.name) {
    case "home":
      return "";
    case "walk-waiting":
      return "#m/walk";
    case "walk-edit":
      return `#m/walk/edit/${view.itemId}`;
    case "walk-review":
      return `#m/walk/review/${view.itemId}`;
    case "walk-tray":
      return "#m/walk/tray";
    case "maint-waiting":
      return "#m/maint";
    case "maint-edit":
      return `#m/maint/edit/${view.itemId}`;
    case "maint-review":
      return `#m/maint/review/${view.itemId}`;
    case "maint-sent":
      return `#m/maint/sent/${view.itemId}`;
  }
}

export function useMobileNav() {
  const [view, setView] = useState<MobileView>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onPopState = () => setView(parseHash(window.location.hash));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Navigate the view machine. `replace` = true keeps the back stack shallow
  // (used by scan-while-editing autosave, so scanning through 20 items
  // doesn't leave 20 entries to back through). Always pushes/replaces with
  // `null` state — the app never reads history.state, only the hash — per
  // Next 16's guidance that the router owns history.state.
  const navigate = useCallback((next: MobileView, opts?: { replace?: boolean }) => {
    const hash = hashFor(next);
    const url = hash === "" ? window.location.pathname + window.location.search : hash;
    if (opts?.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setView(next);
  }, []);

  return { view, navigate };
}
