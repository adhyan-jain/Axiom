"use server";

/**
 * Server Actions backing the Actions page's Approve/Reject buttons. Same pattern as
 * apps/web/app/events/actions.ts: runs on the server so it can touch Prisma directly
 * without any internal-secret header ever reaching the browser. Approving flips the
 * ApprovalRequest to APPROVED and writes an audit entry recording the resolving user;
 * it does not itself replay the underlying toolInvocation (that execution path belongs
 * to the operator agent) — this is the human authorization step the gate was waiting on.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

type Resolution = "APPROVED" | "REJECTED";

async function resolveApproval(approvalId: string, resolution: Resolution) {
  const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!approval) {
    return { ok: false as const, error: "Approval request not found" };
  }
  if (approval.status !== "PENDING") {
    return { ok: false as const, error: `Approval already resolved (${approval.status})` };
  }

  try {
    await prisma.$transaction([
      prisma.approvalRequest.update({
        where: { id: approvalId },
        data: { status: resolution, resolvedAt: new Date() },
      }),
      prisma.auditLogEntry.create({
        data: {
          orgId: approval.orgId,
          agent: "founder",
          action: resolution === "APPROVED" ? "Approved pending action" : "Rejected pending action",
          tool: "approval_resolution",
          input: { approvalId: approval.id, toolInvocation: approval.toolInvocation },
          output: { status: resolution },
          authorizationDecision: resolution === "APPROVED" ? "allowed:override" : "blocked:override",
          result: resolution === "APPROVED" ? "success" : "n/a",
          verificationStatus: "unverified",
        },
      }),
    ]);

    revalidatePath("/actions");
    revalidatePath("/audit");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to resolve approval") };
  }
}

export async function approveActionRequest(approvalId: string) {
  return resolveApproval(approvalId, "APPROVED");
}

export async function rejectActionRequest(approvalId: string) {
  return resolveApproval(approvalId, "REJECTED");
}
