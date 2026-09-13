# Axiom — Seed data design (DRAFT)

Concrete content for the flagship demo seed script (SDD §8). This is the data/narrative,
not code — meant to be transcribed almost verbatim into `apps/web/prisma/seed.ts` once the
scaffold settles. All money figures are INR; schema stores minor units (paise) — amounts
below are given in ₹ with the paise value noted where it matters.

All entities below belong to one seeded `Organization`.

## Organization & founder

- **Organization**: name `"Kestrel Labs"` — a fictional early-stage B2B SaaS startup
  (dev-tooling / observability niche, plausible for an Indian solo-founder pre-seed
  company).
- **User (founder)**: name `"Aarav Mehta"`, email `founder@kestrellabs.dev`.
- **Membership**: Aarav, role `OWNER`.

## Goal & milestone

- **Goal**: metric `"ARR"`, title `"Reach ₹10L ARR"`, targetValue = ₹10,00,000
  (100000000 paise), currentValue = ₹2,40,000 (24000000 paise), deadline = 2027-03-31,
  status `ACTIVE`.
- **Milestone**: title `"₹5L ARR — halfway point"`, targetValue = ₹5,00,000
  (50000000 paise), currentValue = ₹2,40,000, deadline = 2026-12-31, status `PENDING`.

## Current state snapshot (pre-demo baseline)

- Cash on hand: **₹18,00,000** (1800000 → 180000000 paise)
- Monthly burn: **₹2,60,000** (26000000 paise)
- Runway: 18,00,000 / 2,60,000 ≈ **6.92 months** → seed one `RunwaySnapshot` row with
  `cashOnHand=180000000`, `monthlyBurn=26000000`, `runwayMonths=6.92`, `computedAt` = seed
  time.
- Seed a matching `BurnSnapshot` row covering the trailing 30 days: `monthlyBurn=26000000`,
  `periodStart` = seed time minus 30 days, `periodEnd` = seed time.

## Customers (3-4, realistic Indian-startup context)

1. **Bengaluru FinFlow Pvt Ltd** — fintech infra client, `status: ACTIVE`.
   - Contract: `"FinFlow — Observability Platform, Annual"`, valueAmount = ₹1,80,000/yr
     (18000000 paise), billingCycle `"annual"`, status `ACTIVE`, started 4 months ago.
   - Invoice: ₹1,80,000, status `PAID`, paid at contract start.
2. **Trellix Commerce (D2C rollups)** — `status: ACTIVE`.
   - Contract: `"Trellix — Monitoring + Alerting, Monthly"`, valueAmount = ₹15,000/mo
     (1500000 paise), billingCycle `"monthly"`, status `ACTIVE`, started 6 months ago.
   - Invoice: ₹15,000, status `PAID`, most recent monthly cycle.
3. **Sundar Logistics Analytics** — `status: ACTIVE`.
   - Contract: `"Sundar — Core Platform, Monthly"`, valueAmount = ₹12,000/mo
     (1200000 paise), billingCycle `"monthly"`, status `ACTIVE`, started 3 months ago.
   - Invoice: ₹12,000, status `PAID`.
4. **Nimbus Health (early-stage healthtech)** — `status: LEAD`.
   - Deal: `"Nimbus Health — Platform Pilot"`, valueAmount = ₹2,00,000 (20000000 paise),
     stage `NEGOTIATION` — this is the deal that step 1 of the demo script converts to a
     signed contract (see below). No Contract/Invoice yet at seed time; created live during
     the demo.

Sum of existing ACTIVE MRR-equivalent baseline (FinFlow ₹1,80,000/yr ≈ ₹15,000/mo + Trellix
₹15,000/mo + Sundar ₹12,000/mo) ≈ ₹42,000/mo ≈ ₹5,04,000/yr run-rate contribution — the
seeded `Goal.currentValue` of ₹2,40,000 is deliberately below this simple sum to represent
"ARR" as a more conservative trailing/recognized figure (avoids the seed data implying the
founder's dashboard math is inconsistent; document in seed script comments that ARR here is
recognized revenue to date this cycle, not simple MRR×12, since the deterministic ARR
formula itself is out of scope for this pass).

## Existing subscriptions & expenses

- **Subscription**: vendor `"AWS"`, amount = ₹45,000/mo (4500000 paise), billingCycle
  `"monthly"`, status `ACTIVE`, started 8 months ago.
- **Subscription**: vendor `"Linear"`, amount = ₹4,500/mo (450000 paise), billingCycle
  `"monthly"`, status `ACTIVE`.
- **Subscription**: vendor `"Vercel"`, amount = ₹8,000/mo (800000 paise), billingCycle
  `"monthly"`, status `ACTIVE`.
- **Subscription**: vendor `"Notion"`, amount = ₹1,500/mo (150000 paise), billingCycle
  `"monthly"`, status `ACTIVE`.
- **Expense** (non-recurring, logged spend): vendor `"Razorpay"`, category
  `INFRASTRUCTURE`, amount = ₹3,200, occurredAt = 12 days ago (payment gateway fees).
- **Expense**: vendor `"Google Workspace"`, category `SAAS_TOOLS`, amount = ₹1,800,
  occurredAt = 20 days ago.
- **Expense**: vendor `"WeWork Koramangala (hot desk)"`, category `OFFICE`, amount =
  ₹18,000, occurredAt = 25 days ago.

These roll up toward the seeded ₹2,60,000/mo burn figure (AWS 45k + Linear 4.5k + Vercel 8k
+ Notion 1.5k = 59k recurring; remainder ≈ ₹2,01,000/mo covers founder's own minimal draw +
contractor payments not itemized individually — note in seed script as a lump
`Expense` row: vendor `"Founder draw + contractor payments"`, category `PAYROLL`, amount =
₹2,01,000, recurring `true`).

## Past events & decisions (for realism)

1. **Event** (3 months ago): source `"manual"`, entityType `"Subscription"`, entityId = AWS
   subscription id, newState `{"amount": 4500000}`, confidence 1.0, processed `true` —
   represents the AWS plan upgrade that set the current baseline.
2. **Event** (5 months ago): source `"github"`, entityType `"Customer"`, entityId = Trellix
   customer id, newState `{"status": "ACTIVE"}`, confidence 0.95, processed `true` —
   Trellix's onboarding repo access was granted, correlated with their contract going live.
3. **Decision** (2 months ago): title `"Stay on AWS over migrating to a cheaper VPS"`,
   reason `"Migration effort not worth it below ₹50k/mo spend; revisit if AWS crosses
   ₹75k/mo."`, date = 2 months ago, reviewDate = 4 months from seed time, status `ACTIVE`.
   This is the decision the demo's step-2 AWS cost-spike event should be checked against
   (Memory Agent surfaces it: "you decided to stay on AWS below ₹75k/mo — current spike
   puts you at ₹X, still under/over threshold").
4. **Decision** (1 month ago): title `"Prioritize Trellix and Sundar renewals over new
   logo acquisition this quarter"`, reason `"Existing accounts are lower CAC than chasing
   new pipeline with current headcount."`, date = 1 month ago, reviewDate = 2 months from
   seed time, status `ACTIVE`.

## Integrations (seeded mode)

One `Integration` row per provider, all `mode: SEEDED`, `status: CONNECTED`:
- `GMAIL`, `SLACK`, `CALENDAR`, `DRIVE`, `GITHUB` — each `lastSyncAt` = seed time.

## Permissions (starter policy table)

Seed a conservative default so the demo can show the approval flow rather than everything
auto-executing:
- `actionType: "create_task"` → `RECOMMEND`
- `actionType: "send_customer_email"` → `DRAFT`
- `actionType: "create_invoice"` → `EXECUTE`
- `actionType: "modify_contract"` → `REQUIRE_APPROVAL`
- `actionType: "cancel_subscription"` → `REQUIRE_APPROVAL`

## Demo script trigger data (SDD §8, three steps)

### Step 1 — new ₹2L contract
Convert the seeded Nimbus Health **Deal** (₹2,00,000, stage `NEGOTIATION`) to `WON`, then
create:
- **Contract**: `"Nimbus Health — Platform Pilot, One-Time"`, valueAmount = ₹2,00,000
  (20000000 paise), billingCycle `"one_time"`, status `SIGNED`, startDate = demo run time.
- **Invoice**: ₹2,00,000, status `SENT` (then agent flow may move it to `PAID` via a
  CashEvent as part of the demo).
- **Event**: source `"manual"` (founder-triggered via command bar or a "simulate event"
  button), entityType `"Contract"`, entityId = new contract id, previousState `null`,
  newState `{"status": "SIGNED", "valueAmount": 20000000}`, confidence 1.0.
- Expected downstream: Observer classifies as high-significance → State Agent bumps
  `Goal.currentValue` from ₹2,40,000 toward ₹4,40,000 (240000 + 200000) and writes a new
  `RunwaySnapshot`/`Trajectory` row → Operator proposes onboarding Tasks, e.g.:
  - Task: title `"Send Nimbus Health onboarding kit"`, why `"New contract signed — kickoff
    within 48h keeps momentum"`, priority `HIGH`.
  - Task: title `"Schedule Nimbus Health kickoff call"`, why `"Standard onboarding SLA"`,
    priority `MEDIUM`.

### Step 2 — AWS cost spike
- **Event**: source `"seed_cron"` (simulated Slack/billing-alert style trigger),
  entityType `"Subscription"`, entityId = AWS subscription id, previousState
  `{"amount": 4500000}`, newState `{"amount": 7800000}` (₹45,000 → **₹78,000**, a ~73%
  spike), confidence 0.9, evidence `["AWS Cost Explorer alert: Sep spend $940 vs $540 Aug
  avg", "Slack #alerts: 'aws-billing-bot: cost anomaly detected on RDS + data transfer'"]`.
- Expected downstream: Observer flags anomaly (crosses the ₹75k/mo threshold referenced in
  the seeded "stay on AWS" Decision above) → Memory Agent surfaces the conflicting/relevant
  Decision → Operator recommends investigation Task:
  - Task: title `"Investigate AWS cost spike (₹45k → ₹78k/mo)"`, why `"Crosses the ₹75k/mo
    threshold set in the 'stay on AWS' decision — re-evaluate or negotiate down"`, impact
    `"₹33k/mo delta ≈ 0.15 months of runway if sustained"`, priority `URGENT`, source
    `"observer_agent"`.
  - Updated `RunwaySnapshot`: monthlyBurn rises from ₹2,60,000 to ₹2,93,000
    (26000000 + 3300000), cashOnHand unchanged at ₹18,00,000 →
    runwayMonths = 1800000/293000 ≈ **6.14 months** (down from 6.92).

### Step 3 — "Should I hire a developer next month?"
Scenario Engine comparison, deterministic runway math over already-known figures:
- **Assumption fed to the engine**: fully-loaded junior/mid developer salary in this
  context = **₹80,000/month** (₹9,60,000/yr fully loaded, i.e. cash cost including any
  employer-side overhead — realistic for a 1-2 yr experience dev hire in Bengaluru at a
  pre-seed startup).
- **Option A — Hire now**: new monthlyBurn = ₹2,60,000 + ₹80,000 = ₹3,40,000
  (post-AWS-spike figure would be ₹3,73,000 if step 2 already landed — scenario should read
  the *current* RunwaySnapshot at demo time, not a hardcoded pre-spike number). Using the
  pre-spike baseline for a clean illustrative number: runwayMonths = 1800000/340000 ≈
  **5.29 months** (down from 6.92, a delta of **-1.63 months**).
- **Option B — Wait 3 months, hire after Nimbus Health + one more renewal lands**:
  projected cash by then ≈ ₹18,00,000 - (2,60,000 × 3) + ₹2,00,000 (Nimbus contract cash-in)
  = ₹18,00,000 - ₹7,80,000 + ₹2,00,000 = ₹12,20,000; monthlyBurn then ₹3,40,000 →
  runwayMonths ≈ 12,20,000/3,40,000 ≈ **3.59 months** at that future point, but with the
  next milestone (₹5L ARR) more plausibly in reach given the new hire's ramp time overlaps
  revenue growth rather than eating runway during flat months.
- **Recommendation** (LLM narration over the above deltas, not independently computed):
  favor **Option B** — hiring now costs ~1.6 months of runway with no revenue offset yet;
  waiting for the Nimbus contract to close (already in motion per step 1) softens the same
  hire's runway impact. Trigger condition to revisit: **"Re-run this scenario once monthly
  recognized revenue crosses ₹3,20,000 (≈ two more customers at Sundar's price point) or
  cash on hand exceeds ₹20,00,000."**
- Seed (or generate live during demo) a **Scenario** row: question = `"Should I hire a
  developer next month?"`, options = JSON array of the two options above with their
  computed `runwayDeltaMonths` (`-1.63` for A, contextualized delta for B), recommendation =
  the text above.

## AuditLogEntry expectations

Every step above must produce at least one `AuditLogEntry` row (per SDD §8's "every step
must produce visible AuditLogEntry rows"). Minimum set for the demo:
- Step 1: entries for the Observer classifying the contract event, the State Agent updating
  Goal/RunwaySnapshot, and the Operator creating each onboarding Task.
- Step 2: entries for the Observer flagging the anomaly, the Memory Agent's Decision-conflict
  check, and the Operator creating the investigation Task.
- Step 3: an entry for the Strategist/Scenario Engine invocation itself (tool = e.g.
  `"run_scenario"`, input = the NL question, output = the two options + recommendation).

Each entry's `authorizationDecision` should reflect the seeded Permission table above (e.g.
Task creation → `"allowed:RECOMMEND"`, since `create_task` is seeded at `RECOMMEND` not
`EXECUTE`).
