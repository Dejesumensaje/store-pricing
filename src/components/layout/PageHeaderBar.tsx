"use client";

import { Breadcrumb, Button } from "@dejesumensaje/converge-ds-experimental";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

type Props = {
  backLabel?: string;
  backHref?: string;
  pendingCount: number;
};

export function PageHeaderBar({ backLabel = "Return to home", backHref = "/", pendingCount }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-6 py-3">
      <Breadcrumb variant="back" label={backLabel} href={backHref} />

      <Button
        variant="primary"
        iconLeft={AlertCircle}
        onClick={() => router.push("/loose-tray")}
      >
        Review pending overrides
        {pendingCount > 0 && (
          <span className="bg-white/25 rounded-full px-1.5 min-w-5 text-center text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </Button>
    </div>
  );
}
