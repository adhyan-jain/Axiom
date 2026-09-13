import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_SECRET = process.env.AGENT_SERVICE_SHARED_SECRET;

function checkInternalAuth(request: Request) {
  if (!INTERNAL_SECRET) return true;
  const header = request.headers.get("X-Axiom-Internal-Secret");
  return header === INTERNAL_SECRET;
}

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
