"use client";

import { useEffect } from "react";
import { Check, Layers } from "lucide-react";

type Props = {
  /** Ordered consequence lines — the item name, the deal it now carries,
      "3 related items updated", "Added to Store Walk"… Each rises in
      staggered under the check. */
  lines: string[];
  onDone: () => void;
  /** Line-pricing propagation: 2–3 REPRESENTATIVE family members that just
      rode into the walk. They fly up into the pending tray (fade + 96%
      scale, shared trajectory) and the tray pulses on receipt — "these
      related items were added to your Store Walk", said with motion, while
      the receipt line states the full count. */
  flyItems?: string[];
};

// Total dwell ~850ms: check pops (350ms), lines stagger in (+80ms each,
// done by ~600ms), brief hold, gone. Long enough to register completion and
// its consequences, short enough that the scan rhythm never breaks. A family
// propagation extends the dwell just enough for the collection flight.
const DWELL_MS = 850;
const FLY_DWELL_MS = 1750;
const FLY_START_MS = 500;
const FLY_STAGGER_MS = 70;
const FLY_DUR_MS = 650;

// The save payoff — a timed full-screen flash, not a screen. It answers
// exactly "what just happened" (each line one consequence) and dismisses
// itself; the scanner's session tally bumps right after as the persistent
// confirmation, so nothing is lost if the eye was on the shelf.
export function SaveOverlay({ lines, onDone, flyItems }: Props) {
  // JS-gated (not CSS): with animations disabled the fly rows would sit
  // stuck at full opacity over the receipt — under reduced motion the
  // receipt line alone carries the propagation.
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fly = !reduced && flyItems && flyItems.length > 0 ? flyItems.slice(0, 3) : null;
  const trayPulseAt = fly ? FLY_START_MS + (fly.length - 1) * FLY_STAGGER_MS + FLY_DUR_MS - 150 : 0;

  useEffect(() => {
    const t = setTimeout(onDone, fly ? FLY_DWELL_MS : DWELL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
      {fly && (
        <span aria-hidden="true" className="rise-in absolute right-5 top-5" style={{ animationDelay: "260ms" }}>
          <span
            className="tray-pulse flex size-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
            style={{ animationDelay: `${trayPulseAt}ms` }}
          >
            <Layers className="size-4.5" aria-hidden="true" />
          </span>
        </span>
      )}
      <span className="pop-in flex size-16 items-center justify-center rounded-full bg-emerald-100">
        <Check className="check-draw size-8 text-emerald-600" aria-hidden="true" />
      </span>
      <div className="flex flex-col items-center gap-1">
        {lines.map((line, i) => (
          <p
            key={line}
            className={`rise-in flex items-center gap-1.5 text-gray-900 ${i === 0 ? "text-lg font-semibold" : "text-sm text-gray-600"}`}
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            {i > 0 && <Check className="size-3.5 text-emerald-600" aria-hidden="true" />}
            {line}
          </p>
        ))}
      </div>
      {fly && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[64%] flex -translate-x-1/2 flex-col items-start gap-1.5"
        >
          {fly.map((name, i) => (
            <span
              key={name}
              className="fly-to-tray flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm"
              style={{ animationDelay: `${FLY_START_MS + i * FLY_STAGGER_MS}ms` }}
            >
              <span className="size-1.5 rounded-full bg-gray-900" />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
