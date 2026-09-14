"use client";

import { useState, useTransition } from "react";
import { PermissionLevel } from "@prisma/client";
import { upsertPermissionAction, deletePermissionAction } from "@/app/settings/permissions/actions";

const LEVELS: PermissionLevel[] = [
  PermissionLevel.READ,
  PermissionLevel.DRAFT,
  PermissionLevel.RECOMMEND,
  PermissionLevel.EXECUTE,
  PermissionLevel.REQUIRE_APPROVAL,
];

const LEVEL_TONE: Record<PermissionLevel, string> = {
  READ: "text-ink-secondary border-hairline",
  DRAFT: "text-signal-uncertainty border-signal-uncertainty/40",
  RECOMMEND: "text-signal-action border-signal-action/40",
  EXECUTE: "text-trajectory-positive border-trajectory-positive/40",
  REQUIRE_APPROVAL: "text-signal-approval border-signal-approval/40",
};

type PermissionLike = {
  id: string;
  actionType: string;
  level: PermissionLevel;
  updatedAt: string | Date;
};

/** One editable row: change level inline (upsert) or remove the rule (reverts the action
 * type to the default RECOMMEND policy rather than leaving a dangling row). */
export default function PermissionRow({ permission }: { permission: PermissionLike }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(permission.level);
  const [removed, setRemoved] = useState(false);

  const changeLevel = (next: PermissionLevel) => {
    setLevel(next);
    setError(null);
    startTransition(async () => {
      const result = await upsertPermissionAction(permission.actionType, next);
      if (!result.ok) setError(result.error);
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deletePermissionAction(permission.id);
      if (!result.ok) setError(result.error);
      else setRemoved(true);
    });
  };

  if (removed) return null;

  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="px-4 py-3 font-num text-body-sm text-ink-primary">{permission.actionType}</td>
      <td className="px-4 py-3">
        <select
          value={level}
          onChange={(e) => changeLevel(e.target.value as PermissionLevel)}
          disabled={isPending}
          className={`rounded-sm border bg-surface-2 px-2 py-1 text-body-sm ${LEVEL_TONE[level]} disabled:opacity-50`}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-body-sm text-ink-faint">{new Date(permission.updatedAt).toLocaleString()}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={remove}
          disabled={isPending}
          className="rounded border border-hairline px-2.5 py-1 text-body-sm text-signal-risk hover:bg-surface-2 disabled:opacity-50"
        >
          Remove
        </button>
        {error && <div className="mt-1 text-body-sm text-signal-risk">{error}</div>}
      </td>
    </tr>
  );
}
