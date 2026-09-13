import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { observerProcess, AgentServiceError } from "@/lib/agentServiceClient";
import { errorMessage } from "@/lib/errors";

/**
 * Runs a single Event through the real Observer agent and persists the classification.
 * Wired from the Inbox/Events UI's "Process with Observer" button
 * (apps/web/app/events/page.tsx) — previously that UI had no such action at all, and
 * events/[id]/route.ts's PATCH only ever flipped `processed: true` with no real
 * classification behind it. This is separate from PATCH because processing is a distinct,
 * agent-backed operation (calls out to agent-service), not a plain field edit.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    const classification = await observerProcess({
      source: event.source,
      entityType: event.entityType,
      previousState: event.previousState,
      newState: event.newState,
      evidence: event.evidence,
    });

    const mergedNewState = {
      ...(typeof event.newState === "object" && event.newState !== null ? event.newState : {}),
      _observerClassification: classification,
    };

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { processed: true, newState: mergedNewState },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: event.orgId,
        agent: "observer",
        action: classification.summary,
        tool: "observer_process",
        input: { eventId: event.id, source: event.source, entityType: event.entityType },
        output: classification,
        authorizationDecision: "allowed:READ",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    return NextResponse.json({ event: updated, classification });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: `agent-service call failed: ${error.message}` },
        { status: error.status === 503 ? 503 : 502 },
      );
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
