import { PrismaClient, MembershipRole, GoalStatus, MilestoneStatus, CustomerStatus, DealStage, ContractStatus, InvoiceStatus, CashDirection, ExpenseCategory, SubscriptionStatus, AssetType, ComplianceStatus, DecisionStatus, IntegrationProvider, IntegrationMode, IntegrationStatus, PermissionLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Axiom database...');

  // Clean existing data for clean re-seeds
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 1. Organization & Founder
  const org = await prisma.organization.create({
    data: {
      name: 'Kestrel Labs',
    },
  });

  const founder = await prisma.user.create({
    data: {
      name: 'Aarav Mehta',
      email: 'founder@kestrellabs.dev',
    },
  });

  await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: founder.id,
      role: MembershipRole.OWNER,
    },
  });

  // 2. Goal & Milestone
  const goal = await prisma.goal.create({
    data: {
      orgId: org.id,
      title: 'Reach ₹10L ARR',
      metric: 'ARR',
      targetValue: 100000000, // ₹10,00,000 in paise
      currentValue: 24000000,  // ₹2,40,000 in paise
      deadline: new Date('2027-03-31'),
      status: GoalStatus.ACTIVE,
    },
  });

  await prisma.milestone.create({
    data: {
      orgId: org.id,
      goalId: goal.id,
      title: '₹5L ARR — halfway point',
      targetValue: 50000000, // ₹5,00,000 in paise
      currentValue: 24000000, // ₹2,40,000 in paise
      deadline: new Date('2026-12-31'),
      status: MilestoneStatus.PENDING,
    },
  });

  // Initial Trajectory Snapshot
  await prisma.trajectory.create({
    data: {
      orgId: org.id,
      goalId: goal.id,
      currentValue: 24000000,
      targetValue: 100000000,
      bottleneck: 'Lead conversion velocity & developer bandwidth for enterprise onboarding',
      nextActions: [
        'Close Nimbus Health pilot contract',
        'Maintain AWS spend below ₹75k/mo',
        'Evaluate junior developer hire upon reaching ₹3.2L MRR'
      ],
    },
  });

  // 3. Financial Snapshots
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await prisma.runwaySnapshot.create({
    data: {
      orgId: org.id,
      cashOnHand: 180000000, // ₹18,00,000
      monthlyBurn: 26000000,  // ₹2,60,000
      runwayMonths: 6.92,
      computedAt: now,
    },
  });

  await prisma.burnSnapshot.create({
    data: {
      orgId: org.id,
      monthlyBurn: 26000000,
      periodStart: thirtyDaysAgo,
      periodEnd: now,
      computedAt: now,
    },
  });

  // 4. Customers, Deals, Contracts, Invoices
  const finflow = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Bengaluru FinFlow Pvt Ltd',
      contactName: 'Rohan Sharma',
      contactEmail: 'rohan@finflow.in',
      status: CustomerStatus.ACTIVE,
    },
  });

  const finflowContract = await prisma.contract.create({
    data: {
      orgId: org.id,
      customerId: finflow.id,
      title: 'FinFlow — Observability Platform, Annual',
      valueAmount: 18000000, // ₹1,80,000
      billingCycle: 'annual',
      startDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
      status: ContractStatus.ACTIVE,
    },
  });

  const finflowInvoice = await prisma.invoice.create({
    data: {
      orgId: org.id,
      customerId: finflow.id,
      contractId: finflowContract.id,
      amount: 18000000,
      status: InvoiceStatus.PAID,
      paidAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.cashEvent.create({
    data: {
      orgId: org.id,
      invoiceId: finflowInvoice.id,
      direction: CashDirection.IN,
      amount: 18000000,
      description: 'Payment received: FinFlow Annual Subscription',
      occurredAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
    },
  });

  const trellix = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Trellix Commerce',
      contactName: 'Ananya Rao',
      contactEmail: 'ananya@trellix.io',
      status: CustomerStatus.ACTIVE,
    },
  });

  await prisma.contract.create({
    data: {
      orgId: org.id,
      customerId: trellix.id,
      title: 'Trellix — Monitoring + Alerting, Monthly',
      valueAmount: 1500000, // ₹15,000/mo
      billingCycle: 'monthly',
      startDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      status: ContractStatus.ACTIVE,
    },
  });

  const sundar = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Sundar Logistics Analytics',
      contactName: 'Vikram Sundar',
      contactEmail: 'vikram@sundarlogistics.com',
      status: CustomerStatus.ACTIVE,
    },
  });

  await prisma.contract.create({
    data: {
      orgId: org.id,
      customerId: sundar.id,
      title: 'Sundar — Core Platform, Monthly',
      valueAmount: 1200000, // ₹12,000/mo
      billingCycle: 'monthly',
      startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      status: ContractStatus.ACTIVE,
    },
  });

  const nimbus = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Nimbus Health',
      contactName: 'Dr. Priya Nair',
      contactEmail: 'priya@nimbushealth.care',
      status: CustomerStatus.LEAD,
    },
  });

  await prisma.deal.create({
    data: {
      orgId: org.id,
      customerId: nimbus.id,
      title: 'Nimbus Health — Platform Pilot',
      valueAmount: 20000000, // ₹2,00,000
      stage: DealStage.NEGOTIATION,
    },
  });

  // 5. Subscriptions & Expenses
  await prisma.subscription.createMany({
    data: [
      {
        orgId: org.id,
        vendor: 'AWS',
        amount: 4500000, // ₹45,000/mo
        billingCycle: 'monthly',
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(now.getTime() - 240 * 24 * 60 * 60 * 1000),
      },
      {
        orgId: org.id,
        vendor: 'Linear',
        amount: 450000, // ₹4,500/mo
        billingCycle: 'monthly',
        status: SubscriptionStatus.ACTIVE,
      },
      {
        orgId: org.id,
        vendor: 'Vercel',
        amount: 800000, // ₹8,000/mo
        billingCycle: 'monthly',
        status: SubscriptionStatus.ACTIVE,
      },
      {
        orgId: org.id,
        vendor: 'Notion',
        amount: 150000, // ₹1,500/mo
        billingCycle: 'monthly',
        status: SubscriptionStatus.ACTIVE,
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        orgId: org.id,
        vendor: 'Razorpay',
        category: ExpenseCategory.INFRASTRUCTURE,
        amount: 320000, // ₹3,200
        occurredAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        recurring: false,
      },
      {
        orgId: org.id,
        vendor: 'Google Workspace',
        category: ExpenseCategory.SAAS_TOOLS,
        amount: 180000, // ₹1,800
        occurredAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        recurring: false,
      },
      {
        orgId: org.id,
        vendor: 'WeWork Koramangala (hot desk)',
        category: ExpenseCategory.OFFICE,
        amount: 1800000, // ₹18,000
        occurredAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        recurring: false,
      },
      {
        orgId: org.id,
        vendor: 'Founder draw + contractor payments',
        category: ExpenseCategory.PAYROLL,
        amount: 20100000, // ₹2,01,000
        occurredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        recurring: true,
      },
    ],
  });

  // 6. Past Decisions
  const awsDecision = await prisma.decision.create({
    data: {
      orgId: org.id,
      title: 'Stay on AWS over migrating to a cheaper VPS',
      reason: 'Migration effort not worth it below ₹50k/mo spend; revisit if AWS crosses ₹75k/mo.',
      date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      reviewDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
      status: DecisionStatus.ACTIVE,
    },
  });

  const renewalDecision = await prisma.decision.create({
    data: {
      orgId: org.id,
      title: 'Prioritize Trellix and Sundar renewals over new logo acquisition this quarter',
      reason: 'Existing accounts are lower CAC than chasing new pipeline with current headcount.',
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      reviewDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      status: DecisionStatus.ACTIVE,
    },
  });

  // 7. Integrations (Seeded Mode)
  await prisma.integration.createMany({
    data: [
      { orgId: org.id, provider: IntegrationProvider.GMAIL, mode: IntegrationMode.SEEDED, status: IntegrationStatus.CONNECTED, lastSyncAt: now },
      { orgId: org.id, provider: IntegrationProvider.SLACK, mode: IntegrationMode.SEEDED, status: IntegrationStatus.CONNECTED, lastSyncAt: now },
      { orgId: org.id, provider: IntegrationProvider.CALENDAR, mode: IntegrationMode.SEEDED, status: IntegrationStatus.CONNECTED, lastSyncAt: now },
      { orgId: org.id, provider: IntegrationProvider.DRIVE, mode: IntegrationMode.SEEDED, status: IntegrationStatus.CONNECTED, lastSyncAt: now },
      { orgId: org.id, provider: IntegrationProvider.GITHUB, mode: IntegrationMode.SEEDED, status: IntegrationStatus.CONNECTED, lastSyncAt: now },
    ],
  });

  // 8. Starter Permission Table
  await prisma.permission.createMany({
    data: [
      { orgId: org.id, actionType: 'create_task', level: PermissionLevel.RECOMMEND },
      { orgId: org.id, actionType: 'send_customer_email', level: PermissionLevel.DRAFT },
      // REQUIRE_APPROVAL (not EXECUTE) so the flagship demo's Step 1 (Nimbus contract)
      // exercises the real approval path: agent-service's permission gate should escalate
      // invoice auto-creation to a persisted ApprovalRequest rather than silently
      // executing it. See docs/DECISIONS.md and apps/web/app/api/demo/run/route.ts.
      { orgId: org.id, actionType: 'create_invoice', level: PermissionLevel.REQUIRE_APPROVAL },
      { orgId: org.id, actionType: 'modify_contract', level: PermissionLevel.REQUIRE_APPROVAL },
      { orgId: org.id, actionType: 'cancel_subscription', level: PermissionLevel.REQUIRE_APPROVAL },
    ],
  });

  // 9. Initial Tasks
  await prisma.task.createMany({
    data: [
      {
        orgId: org.id,
        title: 'Follow up with Dr. Priya Nair on Nimbus Health pilot proposal',
        why: 'Deal is in final negotiation stage (₹2,00,000 value)',
        impact: 'Closes 20% of remaining gap to ₹5L ARR milestone',
        source: 'operator_agent',
        priority: 'HIGH',
      },
      {
        orgId: org.id,
        title: 'Review Q3 AWS Reserved Instance options',
        why: 'AWS spend currently at ₹45k/mo',
        impact: 'Could save 15-20% on infra burn',
        source: 'strategist_agent',
        priority: 'MEDIUM',
      },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
