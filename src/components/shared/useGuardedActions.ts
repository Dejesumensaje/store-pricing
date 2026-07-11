"use client";

import { useEffect, useRef } from "react";

// Guards against the keydown that opens a modal also immediately firing a
// button inside it. Returns a wrapper that swallows calls within 350 ms of
// the modal opening.
export function useGuardedActions(open: boolean) {
  const openedAt = useRef(0);
  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open]);
  return (fn: () => void) => () => {
    if (Date.now() - openedAt.current < 350) return;
    fn();
  };
}
