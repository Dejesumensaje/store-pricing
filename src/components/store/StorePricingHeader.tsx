"use client";

// Rendered as a fragment so the title, address, and the sibling Batch-tray
// button are all direct flex children of the page header row. `order` + the
// address's `w-full md:w-auto` drive the responsive wrap:
//   mobile  → row 1: title ⋯ batch tray (pinned right) / row 2: address
//   desktop → title · address ⋯⋯⋯ batch tray (single row)
export function StorePricingHeader() {
  return (
    <>
      <h1 className="order-1 text-2xl font-bold text-gray-900">Store #1402</h1>
      <div className="order-3 w-full md:order-2 md:w-auto">
        <span className="text-base text-gray-500 md:ml-1">
          902 S. Locust St, Glenwood, IA 51534
        </span>
      </div>
    </>
  );
}
