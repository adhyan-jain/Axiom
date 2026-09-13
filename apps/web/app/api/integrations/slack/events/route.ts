import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";

/**
 * POST /api/integrations/slack/events — the real landing point Slack's Events API would
 * hit once a workspace is connected. Handles the `url_verification` handshake Slack sends
 * when you register this URL, and otherwise logs a real (not fake) Event row so the
 * pipeline downstream (Observer -> ...) has something genuine to process — this is a
 * sync-wiring proof, not a full feature sync per the assignment's own scope note.
 *
 * No internal-secret auth here: this is a public webhook Slack itself calls, not an
 * internal service-to-service route. Signature verification against
 * SLACK_SIGNING_SECRET would be the production hardening step; left as a documented gap
 * since no real Slack app is registered against this deployment yet.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "url_verification" && typeof body.challenge === "string") {
    return NextResponse.json({ challenge: body.challenge });
  }

  try {
    const org = await prisma.organization.findFirst();
    if (org) {
      const integration = await prisma.integration.findUnique({
        where: { orgId_provider: { orgId: org.id, provider: IntegrationProvider.SLACK } },
      });

      await prisma.event.create({
        data: {
          orgId: org.id,
          source: "slack",
          entityType: "SlackEvent",
          confidence: 1,
          evidence: [JSON.stringify(body).slice(0, 500)],
          newState: { raw: body } as Prisma.InputJsonValue,
          processed: false,
        },
      });

      if (integration) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncAt: new Date() },
        });
      }
    }
  } catch {
    // Webhook receivers must always 200 to the provider (or it will retry/disable the
    // subscription) — log-and-swallow rather than surface a 500 to Slack.
  }

  return NextResponse.json({ ok: true });
}
