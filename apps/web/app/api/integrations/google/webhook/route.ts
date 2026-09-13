import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";

/**
 * POST /api/integrations/google/webhook — landing point for Google's Cloud Pub/Sub push
 * notifications (Gmail/Calendar/Drive watch channels all funnel through the same shape:
 * a resource id + a channel header). Real Google wiring registers a `watch()` per
 * resource and points it here; without live credentials this endpoint is unreachable
 * from Google, but it proves the receiver exists and writes a real Event, same as the
 * Slack stub. Google identifies the resource via the `X-Goog-Resource-State` and
 * `X-Goog-Channel-Id` headers rather than a JSON body.
 */
export async function POST(request: Request) {
  const resourceState = request.headers.get("x-goog-resource-state");
  const channelId = request.headers.get("x-goog-channel-id");

  try {
    const org = await prisma.organization.findFirst();
    if (org) {
      await prisma.event.create({
        data: {
          orgId: org.id,
          source: "google",
          entityType: "GoogleWatchNotification",
          confidence: 1,
          evidence: channelId ? [channelId] : [],
          newState: { resourceState, channelId },
          processed: false,
        },
      });

      for (const provider of [IntegrationProvider.GMAIL, IntegrationProvider.CALENDAR, IntegrationProvider.DRIVE]) {
        const integration = await prisma.integration.findUnique({
          where: { orgId_provider: { orgId: org.id, provider } },
        });
        if (integration?.status === "CONNECTED") {
          await prisma.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
        }
      }
    }
  } catch {
    // Same reasoning as the Slack receiver: always ack, never let a storage error
    // surface as a failed webhook delivery to Google.
  }

  return NextResponse.json({ ok: true });
}
