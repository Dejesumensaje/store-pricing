"use client";

import { Info } from "lucide-react";

// Slim guidance header for the HQ Recommendations queue. Reinforces the "already
// live" model and the review action (keep vs. change). Shown only on the HQ tab
// while there are items left to review.
export function HqReviewBanner({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="text-sm text-gray-600">
        <span className="font-medium text-gray-800">
          HQ updated {count} {count === 1 ? "price" : "prices"} — already live.
        </span>{" "}
        Review each one: keep it as is, or set your own price.
      </p>
    </div>
  );
}
