"use client";

import { useState, useTransition } from "react";
import { PermissionLevel } from "@prisma/client";
import { upsertPermissionAction } from "@/app/settings/permissions/actions";

const LEVELS: PermissionLevel[] = [
  PermissionLevel.READ,
  PermissionLevel.DRAFT,
  PermissionLevel.RECOMMEND,
  PermissionLevel.EXECUTE,
  PermissionLevel.REQUIRE_APPROVAL,
];

/** Create-a-new-rule form for Settings/Permissions. Upsert semantics: submitting an
 * actionType that already has a rule updates it in place rather than erroring. */
export default function PermissionForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState("");
  const [level, setLevel] = useState<PermissionLevel>(PermissionLevel.RECOMMEND);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertPermissionAction(actionType, level);
      if (!result.ok) {
        setError(result.error);
      } else {
        setActionType("");
        setLevel(PermissionLevel.RECOMMEND);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Add a permission rule">
      <label className="space-y-1 text-body-sm">
        <span className="text-ink-secondary">Action type</span>
        <input
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          required
          className="w-56 rounded border border-hairline bg-surface-3 px-2 py-1.5 font-num text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          placeholder="e.g. send_invoice_email"
        />
      </label>
      <label className="space-y-1 text-body-sm">
        <span className="text-ink-secondary">Authority level</span>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as PermissionLevel)}
          className="rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-hairline bg-signal-action/20 px-3 py-1.5 text-body-sm font-medium text-signal-action hover:bg-signal-action/30 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Set rule"}
      </button>
      {error && <span className="text-body-sm text-signal-risk">{error}</span>}
    </form>
  );
}
