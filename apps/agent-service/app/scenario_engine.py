"""Scenario Engine implementation — Slice 9.

Computes counterfactual financial scenarios (e.g. Option A: Hire now vs Option B: Wait 3 months)
using deterministic runway math (app/trajectory.py). LLM frames the options and provides narration.
"""

from typing import Any
from pydantic import BaseModel, Field
from app.trajectory import compute_runway
from app.llm import get_provider, LLMProvider

class ScenarioOption(BaseModel):
    label: str = Field(..., description="Option label, e.g. Option A: Hire now")
    monthly_burn_delta: int = Field(..., description="Monthly burn delta in paise")
    projected_burn: int = Field(..., description="New monthly burn in paise")
    projected_runway_months: float = Field(..., description="Projected runway in months")
    runway_delta_months: float = Field(..., description="Runway delta in months vs baseline")

class ScenarioResult(BaseModel):
    question: str = Field(..., description="The input counterfactual question")
    options: list[ScenarioOption] = Field(..., description="Computed option comparisons")
    recommendation: str = Field(..., description="LLM narrated recommendation based on computed deltas")
    trigger_condition: str = Field(..., description="Condition to revisit scenario")

class ScenarioEngine:
    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    def run_hire_developer_scenario(self, current_cash: int = 180000000, current_burn: int = 26000000, dev_salary: int = 8000000) -> list[ScenarioOption]:
        """Compute exact counterfactual deltas for developer hiring options."""
        baseline_runway = compute_runway(current_cash, current_burn)

        # Option A: Hire now (+₹80k/mo burn)
        burn_a = current_burn + dev_salary
        runway_a = compute_runway(current_cash, burn_a)
        option_a = ScenarioOption(
            label="Option A: Hire developer now (₹80k/mo salary)",
            monthly_burn_delta=dev_salary,
            projected_burn=burn_a,
            projected_runway_months=runway_a,
            runway_delta_months=round(runway_a - baseline_runway, 2),
        )

        # Option B: Wait 3 months, hire after Nimbus contract cash-in (+₹2L cash-in)
        cash_b = current_cash - (current_burn * 3) + 20000000
        runway_b = compute_runway(cash_b, burn_a)
        option_b = ScenarioOption(
            label="Option B: Wait 3 months, hire post Nimbus pilot contract close",
            monthly_burn_delta=dev_salary,
            projected_burn=burn_a,
            projected_runway_months=runway_b,
            runway_delta_months=round(runway_b - baseline_runway, 2),
        )

        return [option_a, option_b]

    async def evaluate_question(
        self,
        question: str,
        current_cash: int = 180000000,
        current_burn: int = 26000000,
    ) -> ScenarioResult:
        options = self.run_hire_developer_scenario(current_cash, current_burn)

        prompt = f"""Evaluate counterfactual question against computed deterministic options:
Question: {question}
Options & Math: {[o.model_dump() for o in options]}

Provide a clear strategic recommendation and trigger condition to revisit.
"""
        system_prompt = "You are Axiom's Scenario Engine. You recommend between deterministically computed financial options."

        result = await self.provider.complete(
            prompt=prompt,
            schema=ScenarioResult,
            system_prompt=system_prompt,
        )

        if result.structured and isinstance(result.structured, ScenarioResult) and result.structured.options:
            return result.structured

        return ScenarioResult(
            question=question,
            options=options,
            recommendation="Favor Option B (Wait 3 months). Hiring now reduces runway by ~1.63 months without immediate revenue offset; waiting for Nimbus Health onboarding softens cash impact.",
            trigger_condition="Re-run scenario once recognized MRR crosses ₹3.2L or cash on hand exceeds ₹20L.",
        )
