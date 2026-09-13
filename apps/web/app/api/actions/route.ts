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

  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const approvals = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks, approvals });
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, title, why, impact, source, priority, toolInvocation, requiresApproval, reason } = body;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) return NextResponse.json({ error: "No org" }, { status: 400 });
      targetOrgId = defaultOrg.id;
    }

    if (requiresApproval) {
      const approval = await prisma.approvalRequest.create({
        data: {
          orgId: targetOrgId,
          toolInvocation: toolInvocation || { title, why },
          stateVersion: "v1.0.0",
          status: "PENDING",
          reason: reason || "Requires approval per policy table",
        },
      });
      return NextResponse.json({ type: "approval", approval }, { status: 201 });
    }

    const task = await prisma.task.create({
      data: {
        orgId: targetOrgId,
        title,
        why: why || "Proposed by Operator agent",
        impact: impact || null,
        source: source || "operator_agent",
        priority: priority || "MEDIUM",
        status: "OPEN",
      },
    });

    return NextResponse.json({ type: "task", task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
