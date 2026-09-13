# Axiom — Evaluation Rubric

> Format matches what `gan-evaluator` (`~/.claude/plugins/marketplaces/ecc/agents/gan-evaluator.md`)
> consumes directly: weighted 1-10 criteria table, PASS/FAIL against a threshold, then
> Critical/Major/Minor issues each with a "how to fix." Criteria below are customized for
> Axiom per `gan-planner`'s own instruction to tailor the rubric to the project (this is
> not a consumer web app, so the stock design/originality/craft/functionality weights from
> the default harness are replaced with criteria that actually matter here: fidelity to
> the locked architecture in `docs/DECISIONS.md`, real demoability, code quality, and
> honesty about what's really built). Read `gan-harness/spec.md` before scoring — it names
> which slice is under test and that slice's Definition of Done.

## How to use this file

1. Identify which Slice (0-10, per `spec.md`) is being evaluated this iteration.
2. Read that slice's "Definition of done" bullet in `spec.md` before testing anything.
3. Pick evaluation mode per slice: `code-only` for Slices 0-3 and 6 (no browser-observable
   surface yet); `playwright` for Slices 4-5 and 7-10 (UI exists and must be clicked
   through, not just read). Record the mode actually achieved, same as the base harness.
4. Score the four criteria below 1-10, apply weights, compare to the pass threshold.
5. Write feedback to `gan-harness/feedback/feedback-NNN.md` in the standard harness format
   (see the "Feedback file format" section below) — the Generator reads this verbatim.

**Pass threshold: 7.0** (same default as the base harness — do not lower it for later
slices; the permission/audit invariants apply with equal weight to every slice).

## Weighted Criteria

### 1. Architectural Fidelity to Locked Decisions (weight: 0.40)

This is the highest-weighted criterion because Axiom's entire value proposition is the
authority model, not UI polish. Score 1-10 against `docs/DECISIONS.md` and SDD §3/§6.
Concretely verify, per slice where applicable:

- **Strands owns the tool loop, never authority.** The permission check happens in a
  Strands `before_tool_call`-style hook that consults the app's own policy table — not
  a system-prompt instruction asking the model to behave. Read the actual hook code; a
  prompt-only "gate" is an automatic critical failure once Slice 5 is in scope.
- **Every tool call writes an `AuditLogEntry`, regardless of outcome** (success, failure,
  blocked, rejected) — timestamp, agent, action, tool, input, output, evidence refs,
  authorization decision, result, verification status. Grep for tool-call code paths that
  skip this; any that do is a critical failure once Slice 4 is in scope.
- **Approval replay + staleness check**: a blocked call persists the exact tool invocation
  plus the state version it was proposed against; approval replays that exact invocation
  (never re-runs agent reasoning); a state change under a pending approval invalidates it.
  Test the staleness path explicitly, not just the happy approve path, once Slice 5 is in
  scope.
- **Deterministic math, LLM narrates only**: runway/burn/ARR-delta/scenario-delta values
  come from plain functions, never LLM-generated numbers. Grep for any place an LLM
  response is parsed as a numeric result rather than narration/recommendation text, once
  Slices 7/9 are in scope.
- **apps/web owns all state; agent-service is stateless.** No direct DB client, ORM import,
  or connection string in `apps/agent-service` — every read/write is an HTTP call back
  into Next.js's internal API.
- **LLM provider abstraction is real for all three providers**, including
  `BedrockStrandsProvider` being genuine Strands+Bedrock wiring gated on credential
  presence, not a `NotImplementedError`/TODO stub, once Slice 2 is in scope.
- **Connector abstraction is real**: `SeededConnector` uses actual fixture data;
  `LiveConnector` raises a real typed `NotConfiguredError`, not a silent no-op or a fake
  success, once Slice 6 is in scope.

Calibration:
- 1-3: A named invariant above is missing or actively violated (e.g. permission check is
  prompt-only, or a tool call bypasses the audit log).
- 4-6: Invariants are present but enforced loosely (e.g. audit log exists but a code path
  can skip it under an error branch).
- 7-8: All in-scope invariants for this slice hold under direct inspection and at least
  one adversarial test (e.g. an over-authority call, a stale-approval replay).
- 9-10: Invariants hold and are covered by an automated regression test that would fail
  if someone reintroduced a prompt-only gate or an unlogged tool call.

### 2. End-to-End Demoability (weight: 0.25)

Does the slice's Definition of Done (from `spec.md`) actually run, clickably or
scriptably, right now — not "would work once X is wired"?

- For Slices 7-9 specifically: does it reproduce the exact SDD §8 flagship step (contract
  → invoice → runway → trajectory; AWS anomaly → recommendation; NL hire-or-wait
  scenario) end to end, with a visible `AuditLogEntry` per step as SDD §8 requires?
- For UI slices: use Playwright to actually click `[Approve]`/`[Reject]`/`[Investigate]`,
  not just confirm the buttons render.
- For code-only slices: run the seed script / API calls fresh (cold DB) and confirm the
  described state change actually happens.

Calibration:
- 1-3: Definition of Done does not run; crashes or requires undocumented manual steps.
- 4-6: Happy path runs; edge cases (empty state, rejected approval, stale approval) break.
- 7-8: Happy path and at least one adversarial/edge case both work as specified.
- 9-10: Cold-start reproducible (fresh seed → full flow) with no manual intervention.

### 3. Code Quality: Types, Error Handling, Tests (weight: 0.20)

- TypeScript: no unexplained `any`; shared contracts actually come from
  `packages/shared-types` rather than being redefined ad hoc in both apps.
- Python: type hints on agent-service public functions/tool signatures; Pydantic models
  for cross-service payloads.
- Error handling: connector `NotConfiguredError`, permission-denial paths, and LLM
  provider failures are handled as typed/explicit branches, not bare `except`/silently
  swallowed promise rejections.
- Tests exist for the slice's new invariant-bearing logic (permission hook, staleness
  check, provider selection precedence, deterministic trajectory math) — not just
  scaffolding smoke tests. Coverage target: ≥80% on new logic per
  `rules/common/testing.md`, but a missing test on a named invariant (permission gate,
  audit log, staleness check, deterministic math) is worse than a coverage-number miss
  elsewhere — flag it as Major even if aggregate coverage looks fine.

Calibration:
- 1-3: No tests for new logic; type errors ignored/suppressed; errors swallowed silently.
- 4-6: Some tests exist but miss the slice's core invariant; types are loose in places.
- 7-8: Core invariant has a passing test; types are sound; errors are explicit and typed.
- 9-10: Invariant tests include the adversarial case (over-authority call, stale approval,
  malformed connector fixture), not just the happy path.

### 4. No Fake/Stubbed Functionality Presented as Real (weight: 0.15)

Grounded in SDD §2 point 1 ("Remaining UI screens exist as scaffolded nav placeholders,
not fake-functional") and the project's broader anti-fake-functionality stance referenced
as "SDD §30" in the fuller 37-section spec (SDD.md §9) — the locked v0.1 SDD encodes the
same rule narrowly: nothing may look done when it isn't.

- Nav placeholders (Customers, Assets, Compliance, Documents, dedicated Integrations
  screen) must read as honestly unbuilt — no fake data, no buttons that silently no-op,
  no "Coming soon" dressed up as a working screen with dead interactions.
- Seeded connector/integration data must be visibly labeled as demo mode in the UI
  (`Integration.mode = "seeded"`) — never presented indistinguishably from live data.
- `LiveConnector` stubs must raise `NotConfiguredError`, not return canned "success"
  responses that look real.
- The Bedrock/Strands LLM path must be real, credential-gated code — not a stub that
  claims to work while actually falling through to mock/anthropic silently.
- No agent tool call may claim a result (in `AuditLogEntry.result` or a UI card) that the
  Verifier did not actually confirm by re-reading state.

Calibration:
- 1-3: Something presents as working/live that is actually fake, hardcoded, or a silent
  no-op — this is a hard fail regardless of other scores; flag as Critical.
- 4-6: Placeholders exist but are ambiguous about their status (e.g. a nav item that looks
  clickable-functional but does nothing, with no visual "not built" signal).
- 7-8: All unbuilt surfaces are honestly and visibly marked; all seeded data is labeled.
- 9-10: 7-8, plus the labeling itself is tested (e.g. a snapshot/assertion that seeded-mode
  badge renders when `Integration.mode === "seeded"`).

## Scoring formula

```
weighted = (architectural_fidelity * 0.40)
         + (demoability            * 0.25)
         + (code_quality           * 0.20)
         + (no_fake_functionality  * 0.15)
```

**Any single Critical issue under "No Fake/Stubbed Functionality" or "Architectural
Fidelity" caps the weighted total at 4.0 regardless of the arithmetic above** — a
beautifully polished screen that fakes a permission check or presents seeded data as live
is a failed slice, not a 6/10 slice. State this override explicitly in feedback when it
applies.

## Feedback file format

Write to `gan-harness/feedback/feedback-NNN.md`:

```markdown
# Evaluation — Slice N, Iteration NNN

## Evaluation Mode
**Achieved:** `code-only` | `playwright`  (state what was actually possible, and why if
it differs from the mode requested for this slice)

## Scores

| Criterion | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Architectural Fidelity | X/10 | 0.40 | X.X |
| End-to-End Demoability | X/10 | 0.25 | X.X |
| Code Quality (types/errors/tests) | X/10 | 0.20 | X.X |
| No Fake/Stubbed Functionality | X/10 | 0.15 | X.X |
| **TOTAL** | | | **X.X/10** |

## Critical-Issue Override
[State "N/A" or name the Critical issue that caps the score at 4.0]

## Verdict: PASS / FAIL (threshold: 7.0)

## Critical Issues (must fix)
1. [Issue]: [What's wrong, with file:line] → [How to fix]

## Major Issues (should fix)
1. [Issue]: [What's wrong, with file:line] → [How to fix]

## Minor Issues (nice to fix)
1. [Issue]: [What's wrong] → [How to fix]

## What Improved Since Last Iteration
- [...]

## What Regressed Since Last Iteration
- [...] (if any)

## Specific Suggestions for Next Iteration
1. [Concrete, actionable, references spec.md's Definition of Done for this slice]

## Screenshots / Evidence
- [Playwright screenshots, or command output for code-only mode]
```

## Feedback quality rules (inherited from the base harness — still apply)

1. Every issue needs a concrete "how to fix," not just a description of the problem.
2. Reference specific files/lines/functions, not "the permission logic needs work."
3. Quantify when possible ("3 of 6 tool-call sites skip the audit write" beats "audit
   logging is incomplete").
4. Compare against `spec.md`'s Definition of Done for the slice under test — that is the
   contract, not general software quality intuition.
5. Never let the Generator's own explanation of a shortcut talk you out of flagging it —
   "the mock provider is fine for now" is not an excuse for a Bedrock path that isn't real.
