"""Permission Gate & Strands Intervention Handler — Slice 5.

Enforces org-scoped permissions (READ/DRAFT/RECOMMEND/EXECUTE/REQUIRE_APPROVAL)
in agent-service's tool layer via Strands intervention hooks (or fallback check function).
"""

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
from strands.interventions import InterventionHandler

class PermissionLevel(str, Enum):
    READ = "READ"
    DRAFT = "DRAFT"
    RECOMMEND = "RECOMMEND"
    EXECUTE = "EXECUTE"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"

LEVEL_HIERARCHY = {
    PermissionLevel.READ: 1,
    PermissionLevel.DRAFT: 2,
    PermissionLevel.RECOMMEND: 3,
    PermissionLevel.EXECUTE: 4,
    PermissionLevel.REQUIRE_APPROVAL: 5,
}

class GateCheckResult(BaseModel):
    allowed: bool
    permission_level: PermissionLevel
    action_type: str
    reason: str | None = None
    requires_approval: bool = False

def check_permission(
    action_type: str,
    required_level: PermissionLevel,
    policy_table: dict[str, str],
) -> GateCheckResult:
    """Evaluate whether an action is allowed given the configured policy table."""
    configured_level_str = policy_table.get(action_type, PermissionLevel.RECOMMEND.value)
    try:
        configured_level = PermissionLevel(configured_level_str)
    except ValueError:
        configured_level = PermissionLevel.RECOMMEND

    if configured_level == PermissionLevel.REQUIRE_APPROVAL:
        return GateCheckResult(
            allowed=False,
            permission_level=configured_level,
            action_type=action_type,
            reason=f"Action '{action_type}' explicitly configured to REQUIRE_APPROVAL",
            requires_approval=True,
        )

    allowed = LEVEL_HIERARCHY[configured_level] >= LEVEL_HIERARCHY[required_level]
    return GateCheckResult(
        allowed=allowed,
        permission_level=configured_level,
        action_type=action_type,
        reason=None if allowed else f"Action '{action_type}' requires level {required_level.value}, but org level is {configured_level.value}",
        requires_approval=not allowed,
    )

class AxiomPermissionInterventionHandler(InterventionHandler):
    """Native Strands InterventionHandler overriding before_tool_call per DECISIONS.md."""

    def __init__(self, policy_table: dict[str, str]):
        super().__init__()
        self.policy_table = policy_table

    def before_tool_call(self, tool_name: str, tool_args: dict[str, Any], agent_context: Any = None):
        result = check_permission(tool_name, PermissionLevel.EXECUTE, self.policy_table)
        if not result.allowed:
            raise PermissionError(result.reason or "Permission denied by Axiom policy gate")
        return True
