"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function doAction(action: "void" | "refund") {
    const confirmMsg = action === "void"
      ? "Void this order? Stock will be restored."
      : "Refund this order? Stock will be restored.";
    if (!confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.detail ?? "Action failed.");
          return;
        }
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  if (status === "voided" || status === "refunded") return null;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        {status === "paid" && (
          <button onClick={() => doAction("refund")} disabled={isPending}
            className="flex-1 rounded-lg border border-yellow-300 text-yellow-700 py-2 text-sm font-medium hover:bg-yellow-50 disabled:opacity-50 transition-colors">
            {isPending ? "Processing…" : "Refund Order"}
          </button>
        )}
        {(status === "open" || status === "paid") && (
          <button onClick={() => doAction("void")} disabled={isPending}
            className="flex-1 rounded-lg border border-red-200 text-red-600 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
            {isPending ? "Processing…" : "Void Order"}
          </button>
        )}
      </div>
    </div>
  );
}
