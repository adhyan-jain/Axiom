/**
 * Shared persistence for "an agent proposed an action" — used by both
 * apps/web/app/api/actions/route.ts's POST handler and the flagship demo runner
 * (apps/web/app/api/demo/run/route.ts), so the approval-vs-execute branch only exists in
 * one place. Per docs/DECISIONS.md: an action above its authorized level gets a persisted
 * `ApprovalRequest` carrying the exact tool invocation + state version, not a silent
 * denial or a straight execution.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

export type ProposedAction = {
  orgId: string;
  title: string;
  why?: string | null;
  impact?: string | null;
  source?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  toolInvocation?: Record<string, unknown>;
  requiresApproval: boolean;
  reason?: string | null;
  stateVersion?: string;
};

export type PersistedTaskResult = { type: "task"; task: Awaited<ReturnType<typeof prisma.task.create>> };
export type PersistedApprovalResult = {
  type: "approval";
  approval: Awaited<ReturnType<typeof prisma.approvalRequest.create>>;
};

/** Persists a proposed action as either an executable Task or a pending ApprovalRequest. */
export async function persistProposedAction(
  proposal: ProposedAction,
): Promise<PersistedTaskResult | PersistedApprovalResult> {
  if (proposal.requiresApproval) {
    const approval = await prisma.approvalRequest.create({
      data: {
        orgId: proposal.orgId,
        toolInvocation: (proposal.toolInvocation ?? { title: proposal.title, why: proposal.why }) as any,
        stateVersion: proposal.stateVersion ?? "v1.0.0",
        status: "PENDING",
        reason: proposal.reason ?? "Requires approval per policy table",
      },
    });
    return { type: "approval", approval };
  }

  const task = await prisma.task.create({
    data: {
      orgId: proposal.orgId,
      title: proposal.title,
      why: proposal.why || "Proposed by Operator agent",
      impact: proposal.impact || null,
      source: proposal.source || "operator_agent",
      priority: (proposal.priority as any) || "MEDIUM",
      status: "OPEN",
    },
  });
  return { type: "task", task };
}
