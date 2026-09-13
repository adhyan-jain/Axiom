"use client";

import { useState, useTransition } from "react";
import { approveActionRequest, rejectActionRequest } from "@/app/actions/actions";

export default function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"APPROVED" | "REJECTED" | null>(null);

  const resolve = (action: "APPROVED" | "REJECTED") => {
    setError(null);
    startTransition(async () => {
      const result =
        action === "APPROVED" ? await approveActionRequest(approvalId) : await rejectActionRequest(approvalId);
      if (!result.ok) {
        setError(result.error);
      } else {
        setResolved(action);
      }
    });
  };

  if (resolved) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {resolved === "APPROVED" ? "Approved" : "Rejected"} — refreshing…
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => resolve("APPROVED")}
          disabled={isPending}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? "Working…" : "Approve"}
        </button>
        <button
          onClick={() => resolve("REJECTED")}
          disabled={isPending}
          className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Working…" : "Reject"}
        </button>
      </div>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
