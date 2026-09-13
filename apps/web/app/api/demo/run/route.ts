import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_SECRET = process.env.AGENT_SERVICE_SHARED_SECRET;

function checkInternalAuth(request: Request) {
  if (!INTERNAL_SECRET) return true;
  const header = request.headers.get("X-Axiom-Internal-Secret");
  return header === INTERNAL_SECRET;
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
      // Step 1: New ₹2L Nimbus Contract signed
      const nimbus = await prisma.customer.findFirst({ where: { name: "Nimbus Health" } });
      let customerId = nimbus?.id;
      if (!customerId) {
        const newCust = await prisma.customer.create({
          data: { orgId: org.id, name: "Nimbus Health", status: "ACTIVE" },
        });
        customerId = newCust.id;
      }

      const contract = await prisma.contract.create({
        data: {
          orgId: org.id,
          customerId,
          title: "Nimbus Health — Platform Pilot, One-Time",
          valueAmount: 20000000, // ₹2,00,000
          billingCycle: "one_time",
          startDate: new Date(),
          status: "SIGNED",
        },
      });

      const event = await prisma.event.create({
        data: {
          orgId: org.id,
          source: "manual",
          entityType: "Contract",
          entityId: contract.id,
          newState: { status: "SIGNED", valueAmount: 20000000, billingCycle: "one_time" },
          confidence: 1.0,
          evidence: ["Signed PDF contract uploaded"],
          processed: true,
        },
      });

      // Update goal & runway
      const activeGoal = await prisma.goal.findFirst({ where: { orgId: org.id, status: "ACTIVE" } });
      if (activeGoal) {
        await prisma.goal.update({
          where: { id: activeGoal.id },
          data: { currentValue: activeGoal.currentValue + 20000000 },
        });
      }

      const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
      const currentCash = (latestRunway?.cashOnHand || 180000000) + 20000000;
      const currentBurn = latestRunway?.monthlyBurn || 26000000;

      await prisma.runwaySnapshot.create({
        data: {
          orgId: org.id,
          cashOnHand: currentCash,
          monthlyBurn: currentBurn,
          runwayMonths: Number((currentCash / currentBurn).toFixed(2)),
        },
      });

      // Log tasks
      await prisma.task.create({
        data: {
          orgId: org.id,
          title: "Send Nimbus Health onboarding kit",
          why: "New contract signed — kickoff within 48h keeps momentum",
          impact: "Unblocks pilot onboarding",
          source: "operator_agent",
          priority: "HIGH",
        },
      });

      // Audit Log Entry
      await prisma.auditLogEntry.create({
        data: {
          orgId: org.id,
          agent: "observer",
          action: "Process signed Nimbus Health contract",
          tool: "process_contract_event",
          input: { contractId: contract.id, value: 20000000 },
          output: { goalUpdated: true, runwayUpdated: true },
          authorizationDecision: "allowed:EXECUTE",
          result: "success",
          verificationStatus: "verified",
        },
      });

      return NextResponse.json({ step: 1, status: "executed", eventId: event.id });
    }

    if (step === 2) {
      // Step 2: AWS Cost Spike anomaly
      const event = await prisma.event.create({
        data: {
          orgId: org.id,
          source: "slack",
          entityType: "Subscription",
          newState: { vendor: "AWS", amount: 7800000 },
          confidence: 0.9,
          evidence: ["AWS Cost Explorer alert: projected $940 spend", "Slack #alerts: cost anomaly detected"],
          processed: true,
        },
      });

      const latestRunway = await prisma.runwaySnapshot.findFirst({ orderBy: { computedAt: "desc" } });
      const currentCash = latestRunway?.cashOnHand || 180000000;
      const newBurn = 29300000; // ₹2.93L

      await prisma.runwaySnapshot.create({
        data: {
          orgId: org.id,
          cashOnHand: currentCash,
          monthlyBurn: newBurn,
          runwayMonths: Number((currentCash / newBurn).toFixed(2)),
        },
      });

      await prisma.task.create({
        data: {
          orgId: org.id,
          title: "Investigate AWS cost spike (₹45k → ₹78k/mo)",
          why: "Crosses ₹75k/mo decision threshold — re-evaluate or negotiate",
          impact: "₹33k/mo delta ≈ 0.15 months runway impact",
          source: "observer_agent",
          priority: "URGENT",
        },
      });

      await prisma.auditLogEntry.create({
        data: {
          orgId: org.id,
          agent: "memory",
          action: "Flag AWS cost spike conflict",
          tool: "check_decision_conflict",
          input: { vendor: "AWS", amount: 7800000 },
          output: { conflictFlagged: true, threshold: 7500000 },
          authorizationDecision: "allowed:RECOMMEND",
          result: "success",
          verificationStatus: "verified",
        },
      });

      return NextResponse.json({ step: 2, status: "executed", eventId: event.id });
    }

    if (step === 3) {
      // Step 3: Developer Hire Scenario Evaluation
      const scenario = await prisma.scenario.create({
        data: {
          orgId: org.id,
          question: "Should I hire a developer next month?",
          options: [
            {
              label: "Option A: Hire developer now (₹80k/mo salary)",
              monthly_burn_delta: 8000000,
              projected_burn: 34000000,
              projected_runway_months: 5.29,
              runway_delta_months: -1.63,
            },
            {
              label: "Option B: Wait 3 months, hire post Nimbus pilot contract close",
              monthly_burn_delta: 8000000,
              projected_burn: 34000000,
              projected_runway_months: 3.59,
              runway_delta_months: -3.33,
            },
          ],
          recommendation: "Favor Option B (Wait 3 months). Hiring now eats ~1.63 months runway before revenue offsets land.",
        },
      });

      await prisma.auditLogEntry.create({
        data: {
          orgId: org.id,
          agent: "strategist",
          action: "Evaluate developer hiring counterfactual scenario",
          tool: "run_scenario",
          input: { question: "Should I hire a developer next month?" },
          output: { recommendedOption: "Option B" },
          authorizationDecision: "allowed:RECOMMEND",
          result: "success",
          verificationStatus: "verified",
        },
      });

      return NextResponse.json({ step: 3, status: "executed", scenarioId: scenario.id });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
