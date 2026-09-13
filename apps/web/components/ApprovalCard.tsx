"use client";

import { useState, useTransition } from "react";
import { approveActionRequest, rejectActionRequest } from "@/app/actions/actions";
import { Surface, AuthorityBadge, CausalChain } from "@/components/primitives";
import type { CausalLink } from "@/components/primitives";
import { StructuredPanel } from "@/components/StructuredData";

type ApprovalLike = {
  id: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "STALE";
  stateVersion: string;
  toolInvocation: unknown;
  createdAt: string | Date;
};

const STATUS_TO_AUTHORITY = {
  PENDING: "awaiting_approval",
  APPROVED: "authorized",
  REJECTED: "rejected",
  STALE: "failed",
} as const;

/**
 * ApprovalCard — a pending action that needs human authority, shown WHY (trigger
 * condition / permission gate reasoning) via CausalChain rather than a raw JSON dump,
 * with "Approve recommendation" as the primary action and "Investigate assumptions"
 * as a secondary disclosure of the exact tool invocation that would run.
 */
export default function ApprovalCard({ approval }: { approval: ApprovalLike }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [investigating, setInvestigating] = useState(false);

  const invocation =
    typeof approval.toolInvocation === "object" && approval.toolInvocation !== null
      ? (approval.toolInvocation as Record<string, unknown>)
      : {};
  const toolName = (invocation.toolName as string | undefined) ?? (invocation.tool as string | undefined);
  const agent = (invocation.agent as string | undefined) ?? "operator";

  const links: CausalLink[] = [
    {
      kind: "Trigger",
      title: approval.reason ?? "Permission policy requires human approval",
      tone: "warning",
    },
    {
      kind: "Proposed action",
      title: toolName ? `${agent} wants to call ${toolName}` : "Operator proposal",
      detail: `Proposed against state version ${approval.stateVersion}`,
      tone: "action",
    },
    {
      kind: "Recommendation",
      title: "Approve to let Axiom execute, or investigate the assumptions first",
      tone: "neutral",
    },
  ];

  const resolve = (action: "APPROVED" | "REJECTED") => {
    setError(null);
    startTransition(async () => {
      const result =
        action === "APPROVED" ? await approveActionRequest(approval.id) : await rejectActionRequest(approval.id);
      if (!result.ok) {
        setError(result.error);
      } else {
        setResolved(action);
      }
    });
  };

  const effectiveStatus = resolved ?? approval.status;

  return (
    <Surface tier={1} className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AuthorityBadge state={STATUS_TO_AUTHORITY[effectiveStatus]} />
        <span className="text-body-sm text-ink-faint">
          {new Date(approval.createdAt).toLocaleString()}
        </span>
      </div>

      <CausalChain links={links} />

      {investigating && (
        <StructuredPanel label="Full proposed tool invocation" data={approval.toolInvocation} />
      )}

      {effectiveStatus === "PENDING" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
          <button
            onClick={() => resolve("APPROVED")}
            disabled={isPending}
            className="rounded border border-trajectory-positive/40 bg-trajectory-positive/15 px-3 py-1.5 text-body-sm font-medium text-trajectory-positive hover:bg-trajectory-positive/25 disabled:opacity-50"
          >
            {isPending ? "Working…" : "Approve recommendation"}
          </button>
          <button
            onClick={() => setInvestigating((v) => !v)}
            className="rounded border border-hairline px-3 py-1.5 text-body-sm text-ink-secondary hover:bg-surface-2"
          >
            {investigating ? "Hide assumptions" : "Investigate assumptions"}
          </button>
          <button
            onClick={() => resolve("REJECTED")}
            disabled={isPending}
            className="rounded border border-signal-risk/40 px-3 py-1.5 text-body-sm text-signal-risk hover:bg-signal-risk/10 disabled:opacity-50"
          >
            {isPending ? "Working…" : "Reject"}
          </button>
          {error && <span className="text-body-sm text-signal-risk">{error}</span>}
        </div>
      )}
    </Surface>
  );
}
