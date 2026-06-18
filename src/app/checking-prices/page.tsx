"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { Store } from "lucide-react";
import Link from "next/link";

export default function CheckingPricesPage() {
  const router = useRouter();

  // Simulate fetching new prices from HQ, then land on the master view.
  useEffect(() => {
    const t = setTimeout(() => router.push("/all-items"), 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="size-20 rounded-2xl border-2 border-gray-300 flex items-center justify-center">
            <Store className="size-9 text-gray-500" strokeWidth={1.5} />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[var(--color-brand)] animate-spin" />
        </div>
        <p className="text-lg font-medium text-gray-700">Checking for new prices…</p>
        <Link href="/all-items" className="text-sm text-gray-400 underline hover:text-gray-600">
          Skip
        </Link>
      </main>
      <footer className="border-t border-gray-200 bg-white py-2.5 px-6 text-center">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">Converge™ by Deloitte</span>
          {" | "}Copyright © Deloitte Development LLC 2026. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
