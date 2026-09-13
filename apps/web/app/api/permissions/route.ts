import { NextResponse } from "next/server";
import { PermissionLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { errorMessage } from "@/lib/errors";

const VALID_LEVELS = new Set(Object.values(PermissionLevel));

export async function GET(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await prisma.permission.findMany();
  return NextResponse.json(permissions);
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, actionType, level } = body;

    if (typeof actionType !== "string" || !actionType) {
      return NextResponse.json({ error: "actionType is required" }, { status: 400 });
    }
    if (!VALID_LEVELS.has(level)) {
      return NextResponse.json(
        { error: `level must be one of: ${[...VALID_LEVELS].join(", ")}` },
        { status: 400 }
      );
    }

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) return NextResponse.json({ error: "No org" }, { status: 400 });
      targetOrgId = defaultOrg.id;
    }

    const permission = await prisma.permission.upsert({
      where: {
        orgId_actionType: { orgId: targetOrgId, actionType },
      },
      update: { level },
      create: { orgId: targetOrgId, actionType, level },
    });

    return NextResponse.json(permission);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
