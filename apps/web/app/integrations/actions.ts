"use server";

/**
 * Server Action backing the Integrations page's Disconnect button. Clears stored tokens
 * and flips status to DISCONNECTED — never a hard delete, so history (lastSyncAt, which
 * provider was ever connected) survives a disconnect/reconnect cycle.
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

export async function disconnectIntegrationAction(integrationId: string) {
  const existing = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!existing) return { ok: false as const, error: "Integration not found" };

  try {
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: "DISCONNECTED",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        lastError: null,
      },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: existing.orgId,
        agent: "founder",
        action: `Disconnected ${existing.provider}`,
        tool: "integration_disconnect",
        input: { provider: existing.provider },
        output: Prisma.JsonNull,
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/integrations");
    revalidatePath("/audit");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to disconnect integration") };
  }
}
