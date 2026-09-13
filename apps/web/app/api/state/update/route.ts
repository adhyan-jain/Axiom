import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internalAuth";
import { errorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, goalCurrentValue, cashOnHand, monthlyBurn, runwayMonths, bottleneck } = body;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) return NextResponse.json({ error: "No org" }, { status: 400 });
      targetOrgId = defaultOrg.id;
    }

    // 1. Update active goal if current value provided
    if (typeof goalCurrentValue === "number") {
      const activeGoal = await prisma.goal.findFirst({
        where: { orgId: targetOrgId, status: "ACTIVE" },
      });
      if (activeGoal) {
        await prisma.goal.update({
          where: { id: activeGoal.id },
          data: { currentValue: goalCurrentValue },
        });

        // Write trajectory snapshot
        await prisma.trajectory.create({
          data: {
            orgId: targetOrgId,
            goalId: activeGoal.id,
            currentValue: goalCurrentValue,
            targetValue: activeGoal.targetValue,
            bottleneck: bottleneck || "Developer bandwidth",
            nextActions: ["Observer & State agent pipeline update"],
          },
        });
      }
    }

    // 2. Create RunwaySnapshot if cash/burn provided
    if (typeof cashOnHand === "number" && typeof monthlyBurn === "number") {
      const computedRunway = runwayMonths || (monthlyBurn > 0 ? cashOnHand / monthlyBurn : 999.0);

      await prisma.runwaySnapshot.create({
        data: {
          orgId: targetOrgId,
          cashOnHand,
          monthlyBurn,
          runwayMonths: Number(computedRunway.toFixed(2)),
        },
      });

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      await prisma.burnSnapshot.create({
        data: {
          orgId: targetOrgId,
          monthlyBurn,
          periodStart: thirtyDaysAgo,
          periodEnd: now,
        },
      });
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
