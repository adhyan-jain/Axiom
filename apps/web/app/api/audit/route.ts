import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { errorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.auditLogEntry.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, agent, action, tool, input, output, evidence, authorizationDecision, result, verificationStatus } = body;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) return NextResponse.json({ error: "No org" }, { status: 400 });
      targetOrgId = defaultOrg.id;
    }

    const auditEntry = await prisma.auditLogEntry.create({
      data: {
        orgId: targetOrgId,
        agent: agent || "system",
        action: action || "tool_call",
        tool: tool || "unknown",
        input: input || {},
        output: output || null,
        evidence: evidence || [],
        authorizationDecision: authorizationDecision || "allowed:EXECUTE",
        result: result || "success",
        verificationStatus: verificationStatus || "unverified",
      },
    });

    return NextResponse.json(auditEntry, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
