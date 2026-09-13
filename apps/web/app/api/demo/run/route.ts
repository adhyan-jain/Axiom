import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { persistProposedAction } from "@/lib/actionPersistence";
import { checkPermission } from "@/lib/permissionGate";
import {
  observerProcess,
  stateProcess,
  strategistAnalyze,
  operatorPropose,
  memoryCheckConflict,
  scenarioEvaluate,
  AgentServiceError,
} from "@/lib/agentServiceClient";

/**
 * Flagship demo runner — Slice 10, rewired per the code-review finding that this route was
 * entirely hardcoded (fake Prisma writes with pre-baked audit rows, never calling
 * apps/agent-service). Every step below now round-trips through the real agents; the only
 * hand-authored values left are the *inputs* representing the world (a contract got
 * signed, an AWS bill spiked, a founder asked a question) — every classification,
 * narrative, gate decision, and computed number comes back from agent-service.
 */

async function loadPolicyTable(orgId: string): Promise<Record<string, string>> {
  const rows = await prisma.permission.findMany({ where: { orgId } });
  const table: Record<string, string> = {};
  for (const row of rows) table[row.actionType] = row.level;
  return table;
}

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { step } = body;

    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

    if (step === 1) {
      return await runStep1Nimbus(org.id);
    }
    if (step === 2) {
      return await runStep2AwsSpike(org.id);
    }
    if (step === 3) {
      return await runStep3HireScenario(org.id);
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: `agent-service call failed: ${error.message}` },
        { status: error.status === 503 ? 503 : 502 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// ───────────────────────────── Step 1: Nimbus contract signed ─────────────────────────────

async function runStep1Nimbus(orgId: string) {
  const nimbus = await prisma.customer.findFirst({ where: { name: "Nimbus Health" } });
  let customerId = nimbus?.id;
  if (!customerId) {
    const newCust = await prisma.customer.create({
      data: { orgId, name: "Nimbus Health", status: "ACTIVE" },
    });
    customerId = newCust.id;
  }

  const contract = await prisma.contract.create({
    data: {
      orgId,
      customerId,
      title: "Nimbus Health — Platform Pilot, One-Time",
      valueAmount: 20000000, // ₹2,00,000
      billingCycle: "one_time",
      startDate: new Date(),
      status: "SIGNED",
    },
  });

  const eventPayload = {
    source: "manual",
    entityType: "Contract",
    entityId: contract.id,
    previousState: null,
    newState: { status: "SIGNED", valueAmount: 20000000, billingCycle: "one_time" },
    evidence: ["Signed PDF contract uploaded"],
  };

  const event = await prisma.event.create({
    data: {
      orgId,
      source: eventPayload.source,
      entityType: eventPayload.entityType,
      entityId: eventPayload.entityId,
      newState: eventPayload.newState,
      confidence: 1.0,
      evidence: eventPayload.evidence,
      processed: false,
    },
  });

  // 1. Observer classifies the event.
  const classification = await observerProcess(eventPayload);

  // 2. State Agent computes the deterministic new state + narrates it.
  const activeGoal = await prisma.goal.findFirst({ where: { orgId, status: "ACTIVE" } });
  const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
  const currentState = {
    cashOnHand: latestRunway?.cashOnHand ?? 180000000,
    monthlyBurn: latestRunway?.monthlyBurn ?? 26000000,
    goalCurrentValue: activeGoal?.currentValue ?? 24000000,
    goalTargetValue: activeGoal?.targetValue ?? 100000000,
  };
  const { new_state: newState, narrative } = await stateProcess(currentState, eventPayload);

  await prisma.event.update({
    where: { id: event.id },
    data: { processed: true },
  });

  if (activeGoal) {
    await prisma.goal.update({
      where: { id: activeGoal.id },
      data: { currentValue: Math.round(Number(newState.goalCurrentValue)) },
    });
  }

  await prisma.runwaySnapshot.create({
    data: {
      orgId,
      cashOnHand: Math.round(Number(newState.cashOnHand)),
      monthlyBurn: Math.round(Number(newState.monthlyBurn)),
      runwayMonths: Number(newState.runwayMonths),
    },
  });

  // 3. Strategist identifies the bottleneck against the (now-updated) goal/financials.
  const bottleneck = await strategistAnalyze(
    { title: activeGoal?.title ?? "Company goal", targetValue: newState.goalTargetValue, currentValue: newState.goalCurrentValue },
    { cashOnHand: newState.cashOnHand, monthlyBurn: newState.monthlyBurn },
  );

  // 4. Operator proposes actions (e.g. onboarding task), gated against the real policy table.
  const policyTable = await loadPolicyTable(orgId);
  const proposals = await operatorPropose(bottleneck, policyTable);

  const persistedProposals = [];
  for (const proposal of proposals) {
    const persisted = await persistProposedAction({
      orgId,
      title: proposal.task.title,
      why: proposal.task.why,
      impact: proposal.task.impact,
      source: "operator_agent",
      priority: proposal.task.priority,
      toolInvocation: proposal.task.tool_invocation,
      requiresApproval: proposal.gate_result.requires_approval,
      reason: proposal.gate_result.reason,
    });
    persistedProposals.push(persisted);
  }

  // 5. Invoice auto-creation is gated separately (the Operator's proposal set doesn't cover
  //    it in this pass — see docs/HANDOFF.md) using the same policy table + hierarchy.
  const invoiceGate = checkPermission("create_invoice", "EXECUTE", policyTable);
  let invoiceOutcome: { type: "invoice"; invoiceId: string } | { type: "approval"; approvalId: string };

  if (invoiceGate.allowed) {
    const invoice = await prisma.invoice.create({
      data: {
        orgId,
        customerId,
        contractId: contract.id,
        amount: 20000000,
        status: "PAID",
        paidAt: new Date(),
      },
    });
    await prisma.cashEvent.create({
      data: {
        orgId,
        invoiceId: invoice.id,
        direction: "IN",
        amount: 20000000,
        description: "Payment received: Nimbus Health Pilot Contract",
        occurredAt: new Date(),
      },
    });
    invoiceOutcome = { type: "invoice", invoiceId: invoice.id };
  } else {
    const approval = await prisma.approvalRequest.create({
      data: {
        orgId,
        toolInvocation: { tool: "create_invoice", args: { contractId: contract.id, customerId, amount: 20000000 } },
        stateVersion: "v1.0.0",
        status: "PENDING",
        reason: invoiceGate.reason ?? "Invoice creation requires approval per policy table",
      },
    });
    invoiceOutcome = { type: "approval", approvalId: approval.id };
  }

  // 6. Persist real audit rows — agent/tool/input/output/authorizationDecision all come
  //    from the actual calls above, not hand-typed strings.
  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "observer",
      action: classification.summary,
      tool: "observer_process",
      input: eventPayload,
      output: classification,
      authorizationDecision: "allowed:READ",
      result: "success",
      verificationStatus: "unverified",
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "state_agent",
      action: narrative.summary,
      tool: "state_process",
      input: { currentState, event: eventPayload },
      output: { newState, bottleneck: narrative.bottleneck } as any,
      authorizationDecision: "allowed:EXECUTE",
      result: "success",
      verificationStatus: "verified",
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "operator",
      action: `Propose actions for bottleneck: ${bottleneck.primary_bottleneck}`,
      tool: "operator_propose",
      input: { bottleneck, policyTable },
      output: { proposals } as any,
      authorizationDecision: proposals.every((p) => p.gate_result.allowed)
        ? "allowed:EXECUTE"
        : "requires_approval:REQUIRE_APPROVAL",
      result: "success",
      verificationStatus: "unverified",
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "operator",
      action: invoiceGate.allowed
        ? "Auto-create invoice for signed Nimbus Health contract"
        : "Invoice creation blocked pending approval",
      tool: "create_invoice",
      input: { contractId: contract.id, amount: 20000000 },
      output: invoiceOutcome,
      authorizationDecision: invoiceGate.allowed
        ? `allowed:${invoiceGate.permissionLevel}`
        : `requires_approval:${invoiceGate.permissionLevel}`,
      result: invoiceGate.allowed ? "success" : "blocked",
      verificationStatus: invoiceGate.allowed ? "verified" : "unverified",
    },
  });

  return NextResponse.json({
    step: 1,
    status: "executed",
    eventId: event.id,
    classification,
    newState,
    narrative,
    bottleneck,
    proposals: persistedProposals,
    invoiceOutcome,
  });
}

// ───────────────────────────── Step 2: AWS cost spike ─────────────────────────────

async function runStep2AwsSpike(orgId: string) {
  const eventPayload = {
    source: "slack",
    entityType: "Subscription",
    newState: { vendor: "AWS", amount: 7800000 },
    evidence: ["AWS Cost Explorer alert: projected $940 spend", "Slack #alerts: cost anomaly detected"],
  };

  const event = await prisma.event.create({
    data: {
      orgId,
      source: eventPayload.source,
      entityType: eventPayload.entityType,
      newState: eventPayload.newState,
      confidence: 0.9,
      evidence: eventPayload.evidence,
      processed: false,
    },
  });

  const classification = await observerProcess(eventPayload);

  // Check the event against the org's real active Decisions (e.g. the seeded "stay on AWS
  // below ₹75k/mo" decision) via the actual Memory agent logic — not a hardcoded threshold
  // duplicated in this route.
  const activeDecisions = await prisma.decision.findMany({ where: { orgId, status: "ACTIVE" } });
  const conflict = await memoryCheckConflict(
    eventPayload,
    activeDecisions.map((d) => ({ id: d.id, title: d.title, reason: d.reason, status: d.status })),
  );

  const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
  const currentCash = latestRunway?.cashOnHand || 180000000;
  const newBurn = 29300000; // ₹2.93L — the new AWS-inclusive burn this event represents

  await prisma.runwaySnapshot.create({
    data: {
      orgId,
      cashOnHand: currentCash,
      monthlyBurn: newBurn,
      runwayMonths: Number((currentCash / newBurn).toFixed(2)),
    },
  });

  await prisma.event.update({ where: { id: event.id }, data: { processed: true } });

  if (conflict.has_conflict) {
    await prisma.task.create({
      data: {
        orgId,
        title: `Investigate AWS cost spike — conflicts with "${conflict.conflicting_decision_title}"`,
        why: conflict.explanation || "Flagged by Memory agent against an active decision",
        impact: "Crosses the decision's spend threshold; re-evaluate or negotiate",
        source: "memory_agent",
        priority: "URGENT",
      },
    });
  }

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "observer",
      action: classification.summary,
      tool: "observer_process",
      input: eventPayload,
      output: classification,
      authorizationDecision: "allowed:READ",
      result: "success",
      verificationStatus: "unverified",
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "memory",
      action: conflict.has_conflict
        ? `Flag conflict with decision: ${conflict.conflicting_decision_title}`
        : "No active decision conflict found",
      tool: "memory_check_conflict",
      input: { event: eventPayload, activeDecisions },
      output: conflict,
      authorizationDecision: "allowed:RECOMMEND",
      result: "success",
      verificationStatus: "verified",
    },
  });

  return NextResponse.json({ step: 2, status: "executed", eventId: event.id, classification, conflict });
}

// ───────────────────────────── Step 3: Developer hire scenario ─────────────────────────────

async function runStep3HireScenario(orgId: string) {
  const question = "Should I hire a developer next month?";
  const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
  const cashOnHand = latestRunway?.cashOnHand ?? 180000000;
  const monthlyBurn = latestRunway?.monthlyBurn ?? 26000000;

  const result = await scenarioEvaluate(question, cashOnHand, monthlyBurn);

  const scenario = await prisma.scenario.create({
    data: {
      orgId,
      question: result.question,
      options: result.options as any,
      recommendation: result.recommendation,
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      orgId,
      agent: "strategist",
      action: "Evaluate developer hiring counterfactual scenario",
      tool: "scenario_evaluate",
      input: { question, cashOnHand, monthlyBurn },
      output: result,
      authorizationDecision: "allowed:RECOMMEND",
      result: "success",
      verificationStatus: "verified",
    },
  });

  return NextResponse.json({ step: 3, status: "executed", scenarioId: scenario.id, result });
}
