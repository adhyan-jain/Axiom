import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { AgentServiceError } from "@/lib/agentServiceClient";
import { runStep1Nimbus, runStep2AwsSpike, runStep3HireScenario } from "@/lib/demoSteps";
import { errorMessage } from "@/lib/errors";

/**
 * Flagship demo runner (SDD §8) — HTTP route for internal/service callers (curl,
 * integration tests). Step logic lives in lib/demoSteps.ts, shared with
 * app/demo-actions.ts (the Server Action the browser's DemoControls buttons actually
 * call — see docs/HANDOFF.md for why the browser can't hit this route directly: it
 * would need to know AGENT_SERVICE_SHARED_SECRET, which must never reach client code).
 */
export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { step } = body;

    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

    if (step === 1) return NextResponse.json(await runStep1Nimbus(org.id));
    if (step === 2) return NextResponse.json(await runStep2AwsSpike(org.id));
    if (step === 3) return NextResponse.json(await runStep3HireScenario(org.id));

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: `agent-service call failed: ${error.message}` },
        { status: error.status === 503 ? 503 : 502 },
      );
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
