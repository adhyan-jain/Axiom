"use server";

/**
 * Server Actions backing Settings/Permissions CRUD. Same direct-Prisma pattern as the
 * other founder-authored CRUD screens (Decisions, Events) — this is org policy
 * configuration, not an agent action, so no agent-service call is involved. The existing
 * internal API route (app/api/permissions/route.ts, upsert by orgId+actionType) stays
 * untouched for programmatic/service callers; this gives the UI a same-origin path that
 * never needs the internal shared secret.
 */
import { revalidatePath } from "next/cache";
import { PermissionLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

export async function upsertPermissionAction(actionType: string, level: PermissionLevel) {
  const trimmed = actionType.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Action type is required" };
  }
  if (!Object.values(PermissionLevel).includes(level)) {
    return { ok: false as const, error: "Invalid permission level" };
  }

  try {
    const org = await prisma.organization.findFirst();
    if (!org) return { ok: false as const, error: "No organization found" };

    const permission = await prisma.permission.upsert({
      where: { orgId_actionType: { orgId: org.id, actionType: trimmed } },
      update: { level },
      create: { orgId: org.id, actionType: trimmed, level },
    });

    await prisma.auditLogEntry.create({
      data: {
        orgId: org.id,
        agent: "founder",
        action: `Set permission '${trimmed}' to ${level}`,
        tool: "permission_upsert",
        input: { actionType: trimmed, level },
        output: { permissionId: permission.id },
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/settings/permissions");
    revalidatePath("/audit");
    return { ok: true as const, permissionId: permission.id };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to save permission") };
  }
}

export async function deletePermissionAction(permissionId: string) {
  const existing = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!existing) return { ok: false as const, error: "Permission not found" };

  try {
    await prisma.permission.delete({ where: { id: permissionId } });

    await prisma.auditLogEntry.create({
      data: {
        orgId: existing.orgId,
        agent: "founder",
        action: `Removed permission rule '${existing.actionType}' (reverts to default RECOMMEND)`,
        tool: "permission_delete",
        input: { permissionId, actionType: existing.actionType },
        output: Prisma.JsonNull,
        authorizationDecision: "allowed:manual",
        result: "success",
        verificationStatus: "unverified",
      },
    });

    revalidatePath("/settings/permissions");
    revalidatePath("/audit");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error, "Failed to delete permission") };
  }
}
