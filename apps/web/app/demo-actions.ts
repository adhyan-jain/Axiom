"use server";

/**
 * Server Action backing the Flagship Demo Controls buttons (components/DemoControls.tsx).
 * Deliberately not a fetch to /api/demo/run: that HTTP route is gated by the internal
 * shared-secret header (lib/internalAuth.ts), which must never reach the browser. A
 * same-origin Server Action runs on the server already, so it can run the same step
 * logic (lib/demoSteps.ts) directly — no HTTP hop, no secret exposure. Mirrors the
 * pattern established in app/events/actions.ts for the "Process with Observer" button.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AgentServiceError } from "@/lib/agentServiceClient";
import { runStep1Nimbus, runStep2AwsSpike, runStep3HireScenario } from "@/lib/demoSteps";

export async function runDemoStepAction(step: 1 | 2 | 3) {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      return { ok: false as const, error: "No organization found" };
    }

    const result =
      step === 1 ? await runStep1Nimbus(org.id) : step === 2 ? await runStep2AwsSpike(org.id) : await runStep3HireScenario(org.id);

    revalidatePath("/");
    revalidatePath("/events");
    revalidatePath("/actions");
    revalidatePath("/decisions");
    revalidatePath("/scenarios");
    revalidatePath("/audit");

    return { ok: true as const, result };
  } catch (error: any) {
    if (error instanceof AgentServiceError) {
      return { ok: false as const, error: `agent-service call failed: ${error.message}` };
    }
    return { ok: false as const, error: error.message ?? "Failed to run demo step" };
  }
}
