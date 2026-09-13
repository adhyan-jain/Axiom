"""Strategist and Operator agents — Slice 6.

Strategist agent analyzes company metrics vs goals to identify the primary bottleneck.
Operator agent proposes specific, actionable Tasks and tool invocations gated by the
permission table.
"""

from typing import Any
from pydantic import BaseModel, Field
from app.llm import get_provider, LLMProvider
from app.permission_gate import check_permission, PermissionLevel

class BottleneckAnalysis(BaseModel):
    primary_bottleneck: str = Field(..., description="Primary bottleneck slowing goal achievement")
    why: str = Field(..., description="Rationale for why this is the primary bottleneck")
    recommended_focus: str = Field(..., description="Strategic focus area for the Operator agent")

class ProposedTask(BaseModel):
    title: str = Field(..., description="Task title")
    why: str = Field(..., description="Why this task is proposed")
    impact: str = Field(..., description="Expected impact")
    action_type: str = Field(..., description="Action type for permission gating (e.g. create_task, send_customer_email)")
    priority: str = Field("MEDIUM", description="Task priority (LOW, MEDIUM, HIGH, URGENT)")
    tool_invocation: dict[str, Any] = Field(default_factory=dict, description="Serialized tool call details")

class OperatorProposals(BaseModel):
    proposals: list[ProposedTask] = Field(default_factory=list, description="List of proposed tasks/actions")

class StrategistAgent:
    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    async def analyze_trajectory(self, goal_data: dict[str, Any], financial_state: dict[str, Any]) -> BottleneckAnalysis:
        prompt = f"""Analyze company trajectory and goals:
Goal: {goal_data}
Financial State: {financial_state}

Identify the primary bottleneck, rationale, and recommended strategic focus.
"""
        result = await self.provider.complete(
            prompt=prompt,
            schema=BottleneckAnalysis,
            system_prompt="You are Axiom's Strategist Agent. You analyze company performance against goals.",
        )
        if result.structured and isinstance(result.structured, BottleneckAnalysis):
            return result.structured
        return BottleneckAnalysis(
            primary_bottleneck="Developer bandwidth for customer onboarding",
            why="Current onboarding queue exceeds solo founder capacity",
            recommended_focus="Automate onboarding workflow and evaluate dev hiring options",
        )

class OperatorAgent:
    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    async def propose_actions(
        self,
        bottleneck: BottleneckAnalysis,
        policy_table: dict[str, str],
    ) -> list[dict[str, Any]]:
        prompt = f"""Propose specific tasks/tool actions based on strategic bottleneck:
Bottleneck: {bottleneck.primary_bottleneck}
Focus: {bottleneck.recommended_focus}
"""
        result = await self.provider.complete(
            prompt=prompt,
            schema=OperatorProposals,
            system_prompt="You are Axiom's Operator Agent. You generate concrete, executable tasks.",
        )

        raw_proposals = result.structured.proposals if (result.structured and isinstance(result.structured, OperatorProposals) and result.structured.proposals) else [
            ProposedTask(
                title="Send Nimbus Health onboarding kit",
                why="Kickoff within 48h keeps momentum",
                impact="Unblocks ₹2L contract implementation",
                action_type="create_task",
                priority="HIGH",
                tool_invocation={"tool": "create_task", "args": {"title": "Send Nimbus Health onboarding kit"}},
            )
        ]

        gated_proposals = []
        for prop in raw_proposals:
            gate_res = check_permission(prop.action_type, PermissionLevel.EXECUTE, policy_table)
            gated_proposals.append({
                "task": prop.model_dump(),
                "gate_result": gate_res.model_dump(),
            })

        return gated_proposals
