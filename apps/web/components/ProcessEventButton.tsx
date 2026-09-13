"use client";

import { useState, useTransition } from "react";
import { processEventAction } from "@/app/events/actions";

export default function ProcessEventButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await processEventAction(eventId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-50 font-medium"
      >
        {isPending ? "Processing..." : "Process with Observer"}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
