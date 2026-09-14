"use server";

/**
 * Server Actions backing Decisions CRUD (create/edit/archive). Same pattern as
 * events/actions.ts and actions/actions.ts — direct Prisma writes from the server, an
 * AuditLogEntry per mutation, no agent-service call needed since organizational memory
 * here is founder-authored/edited, not agent-proposed.
 */
import { revalidatePath } from "next/cache";
import { Prisma, DecisionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

export type DecisionFormInput = {
  title: string;
  reason: string;
  evidence: string; // newline-separated
  consequences: string;
  relatedEventIds: string; // comma-separated event ids
  reviewDate: string; // yyyy-mm-dd or ""
  status: DecisionStatus;
};

function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

function parseCsv(raw: string): string[] {
  return raw.split(",").map((l) => l.trim()).filter(Boolean);
}

export async function createDecisionAction(input: DecisionFormInput) {
  if (!input.title.trim() || !input.reason.trim()) {
    return { ok: false as const, error: "Title and rationale are required" };
  }
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return { ok: false as const, error: "No organization found" };

    const decision = await prisma.decision.create({
      data: {
        orgId: org.id,
        title: input.title.trim(),
        reason: input.reason.trim(),
        evidence: parseLines(input.evidence),
        consequences: input.consequences.trim() || null,
        relatedEventIds: parseCsv(input.relatedEventIds),
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
        status: input.status,
      },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: org.id,
        agent: "founder",
        action: `Recorded decision: ${decision.title}`,
        tool: "decision_create",
        input: { title: decision.title },
        output: { decisionId: decision.id },
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/decisions");
    revalidatePath("/audit");
    return { ok: true as const, decisionId: decision.id };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to create decision") };
  }
}

export async function updateDecisionAction(decisionId: string, input: DecisionFormInput) {
  if (!input.title.trim() || !input.reason.trim()) {
    return { ok: false as const, error: "Title and rationale are required" };
  }
  const existing = await prisma.decision.findUnique({ where: { id: decisionId } });
  if (!existing) return { ok: false as const, error: "Decision not found" };

  try {
    await prisma.decision.update({
      where: { id: decisionId },
      data: {
        title: input.title.trim(),
        reason: input.reason.trim(),
        evidence: parseLines(input.evidence),
        consequences: input.consequences.trim() || null,
        relatedEventIds: parseCsv(input.relatedEventIds),
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
        status: input.status,
      },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: existing.orgId,
        agent: "founder",
        action: `Edited decision: ${input.title.trim()}`,
        tool: "decision_update",
        input: { decisionId },
        output: Prisma.JsonNull,
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/decisions");
    revalidatePath("/audit");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to update decision") };
  }
}

/** Archive = mark SUPERSEDED rather than delete — organizational memory should never vanish. */
export async function archiveDecisionAction(decisionId: string) {
  const existing = await prisma.decision.findUnique({ where: { id: decisionId } });
  if (!existing) return { ok: false as const, error: "Decision not found" };

  try {
    await prisma.decision.update({
      where: { id: decisionId },
      data: { status: DecisionStatus.SUPERSEDED },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: existing.orgId,
        agent: "founder",
        action: `Archived decision: ${existing.title}`,
        tool: "decision_archive",
        input: { decisionId },
        output: Prisma.JsonNull,
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/decisions");
    revalidatePath("/audit");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to archive decision") };
  }
}
