import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { errorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const processed = searchParams.get("processed");

  const where: any = {};
  if (orgId) where.orgId = orgId;
  if (processed !== null && processed !== undefined) {
    where.processed = processed === "true";
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, source, entityType, entityId, previousState, newState, confidence, evidence } = body;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) {
        return NextResponse.json({ error: "No organization found" }, { status: 400 });
      }
      targetOrgId = defaultOrg.id;
    }

    const event = await prisma.event.create({
      data: {
        orgId: targetOrgId,
        source: source || "manual",
        entityType: entityType || "General",
        entityId: entityId || null,
        previousState: previousState || null,
        newState: newState || null,
        confidence: typeof confidence === "number" ? confidence : 1.0,
        evidence: evidence || [],
        processed: false,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
