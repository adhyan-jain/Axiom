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

  const decisions = await prisma.decision.findMany({
    orderBy: { date: "desc" },
    include: {
      conflictsFrom: { include: { conflictsWith: true } },
    },
  });

  return NextResponse.json(decisions);
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, title, reason, reviewDate, status } = body;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) return NextResponse.json({ error: "No org" }, { status: 400 });
      targetOrgId = defaultOrg.id;
    }

    const decision = await prisma.decision.create({
      data: {
        orgId: targetOrgId,
        title,
        reason,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        status: status || "ACTIVE",
      },
    });

    return NextResponse.json(decision, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
