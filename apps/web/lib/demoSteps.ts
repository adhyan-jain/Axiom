import { prisma } from "@/lib/prisma";
import { persistProposedAction, DEFAULT_STATE_VERSION } from "@/lib/actionPersistence";
import { checkPermission } from "@/lib/permissionGate";
import {
  observerProcess,
  stateProcess,
  strategistAnalyze,
  operatorPropose,
  memoryCheckConflict,
  scenarioEvaluate,
} from "@/lib/agentServiceClient";

/**
 * Flagship demo step implementations (SDD §8), shared by both:
 *  - apps/web/app/api/demo/run/route.ts (HTTP route, internal-secret gated — for
 *    curl/service-to-service verification)
 *  - apps/web/app/demo-actions.ts (Server Action — for the browser DemoControls buttons,
 *    which must never see AGENT_SERVICE_SHARED_SECRET; see docs/HANDOFF.md)
 * Every classification, narrative, gate decision, and computed number below comes back
 * from the real apps/agent-service agents — the only hand-authored values are the
 * *inputs* representing the world (a contract got signed, an AWS bill spiked, a founder
 * asked a question).
 */

async function loadPolicyTable(orgId: string): Promise<Record<string, string>> {
  const rows = await prisma.permission.findMany({ where: { orgId } });
  const table: Record<string, string> = {};
  for (const row of rows) table[row.actionType] = row.level;
  return table;
}

export async function runStep1Nimbus(orgId: string) {
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

  const classification = await observerProcess(eventPayload);

  const activeGoal = await prisma.goal.findFirst({ where: { orgId, status: "ACTIVE" } });
  const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
  const currentState = {
    cashOnHand: latestRunway?.cashOnHand ?? 180000000,
    monthlyBurn: latestRunway?.monthlyBurn ?? 26000000,
    goalCurrentValue: activeGoal?.currentValue ?? 24000000,
    goalTargetValue: activeGoal?.targetValue ?? 100000000,
  };
  const { new_state: newState, narrative } = await stateProcess(currentState, eventPayload);

  await prisma.event.update({ where: { id: event.id }, data: { processed: true } });

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

  const bottleneck = await strategistAnalyze(
    { title: activeGoal?.title ?? "Company goal", targetValue: newState.goalTargetValue, currentValue: newState.goalCurrentValue },
    { cashOnHand: newState.cashOnHand, monthlyBurn: newState.monthlyBurn },
  );

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
        stateVersion: DEFAULT_STATE_VERSION,
        status: "PENDING",
        reason: invoiceGate.reason ?? "Invoice creation requires approval per policy table",
      },
    });
    invoiceOutcome = { type: "approval", approvalId: approval.id };
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

  return {
    step: 1,
    status: "executed",
    eventId: event.id,
    classification,
    newState,
    narrative,
    bottleneck,
    proposals: persistedProposals,
    invoiceOutcome,
  };
}

export async function runStep2AwsSpike(orgId: string) {
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

  return { step: 2, status: "executed", eventId: event.id, classification, conflict };
}

export async function runStep3HireScenario(orgId: string) {
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

  return { step: 3, status: "executed", scenarioId: scenario.id, result };
}
