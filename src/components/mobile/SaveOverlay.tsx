"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

type Props = {
  /** Ordered consequence lines — "Price updated", "3 related items updated",
      "Added to Store Walk"… Each rises in staggered under the check. */
  lines: string[];
  onDone: () => void;
};

// Total dwell ~850ms: check pops (350ms), lines stagger in (+80ms each,
// done by ~600ms), brief hold, gone. Long enough to register completion and
// its consequences, short enough that the scan rhythm never breaks.
const DWELL_MS = 850;

// The save payoff — a timed full-screen flash, not a screen. It answers
// exactly "what just happened" (each line one consequence) and dismisses
// itself; the scanner's session tally bumps right after as the persistent
// confirmation, so nothing is lost if the eye was on the shelf.
export function SaveOverlay({ lines, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, DWELL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
      <span className="pop-in flex size-16 items-center justify-center rounded-full bg-emerald-100">
        <Check className="size-8 text-emerald-600" aria-hidden="true" />
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
    </div>
  );
}
