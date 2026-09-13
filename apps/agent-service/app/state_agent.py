"""State Agent implementation — Slice 4.

Processes classified events and updates canonical entity metrics (Goal progress, RunwaySnapshot,
BurnSnapshot) by calling back into Next.js's state updating endpoints. Math is 100% deterministic,
using app/trajectory.py.
"""

from typing import Any
from pydantic import BaseModel, Field
from app.trajectory import compute_runway, compute_burn_delta, compute_goal_progress
from app.llm import get_provider, LLMProvider

class StateUpdateNarrative(BaseModel):
    summary: str = Field(..., description="Narrative summary of state update and updated metrics")
    bottleneck: str = Field(..., description="Current primary operational bottleneck after state update")

class StateAgent:
    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    def calculate_new_state(self, current_state: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
        """Compute exact updated metrics deterministically."""
        cash = current_state.get("cashOnHand", 180000000)
        burn = current_state.get("monthlyBurn", 26000000)
        goal_val = current_state.get("goalCurrentValue", 24000000)
        goal_target = current_state.get("goalTargetValue", 100000000)

        new_state = {
            "cashOnHand": cash,
            "monthlyBurn": burn,
            "goalCurrentValue": goal_val,
            "goalTargetValue": goal_target,
        }

        entity_type = event.get("entityType")
        payload = event.get("newState") or {}

        if entity_type == "Contract" and payload.get("status") in ["SIGNED", "ACTIVE"]:
            value = payload.get("valueAmount", 0)
            new_state["goalCurrentValue"] += value
            # Assume cash increases if contract invoice is paid immediately
            if payload.get("billingCycle") == "one_time":
                new_state["cashOnHand"] += value

        elif entity_type == "Subscription" or entity_type == "Expense":
            new_burn = payload.get("amount")
            if new_burn is not None:
                new_state["monthlyBurn"] = new_burn

        new_state["runwayMonths"] = compute_runway(new_state["cashOnHand"], new_state["monthlyBurn"])
        new_state["goalProgress"] = compute_goal_progress(new_state["goalCurrentValue"], new_state["goalTargetValue"])

        return new_state

    async def narrate_update(self, old_state: dict[str, Any], new_state: dict[str, Any], event: dict[str, Any]) -> StateUpdateNarrative:
        prompt = f"""Narrate the state update for Axiom based on the following deterministic state change:

Event: {event}
Old State: {old_state}
New State: {new_state}

Provide a concise summary and identify the current primary operational bottleneck.
"""
        system_prompt = "You are Axiom's State Agent. You summarize deterministic financial and goal metric updates."

        result = await self.provider.complete(
            prompt=prompt,
            schema=StateUpdateNarrative,
            system_prompt=system_prompt,
        )

        if result.structured and isinstance(result.structured, StateUpdateNarrative):
            return result.structured

        return StateUpdateNarrative(
            summary=f"State updated: Runway now {new_state['runwayMonths']} months, Goal progress {new_state['goalProgress']}%.",
            bottleneck="Developer bandwidth & sales pipeline conversion",
        )
