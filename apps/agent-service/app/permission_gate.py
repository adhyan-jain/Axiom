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

class ApprovalRequiredError(Exception):
    """Raised by AxiomPermissionInterventionHandler.before_tool_call when the blocked tool
    call is a REQUIRE_APPROVAL (or otherwise escalatable) case rather than a hard denial.

    Distinguishing this from a bare PermissionError matters per DECISIONS.md: an action
    above its authorized level should surface as a persisted `ApprovalRequest` (the exact
    tool invocation + state version, replayed on approval — never re-run the agent's
    reasoning), not just an exception that dead-ends the call. Since agent-service is
    stateless, it cannot persist that ApprovalRequest itself; it raises this typed error so
    the calling endpoint (e.g. `/operator/propose` in app/main.py) can catch it and return a
    structured "needs approval" response instead of a bare 500 — the actual persistence
    happens in apps/web (see actions/route.ts and lib/actionPersistence.ts), which is the
    only component that owns state.

    Carries the full `GateCheckResult` so callers have the permission level, action type,
    and reason without re-deriving them.
    """

    def __init__(self, gate_result: GateCheckResult):
        self.gate_result = gate_result
        super().__init__(gate_result.reason or "Action requires approval")


class AxiomPermissionInterventionHandler(InterventionHandler):
    """Native Strands InterventionHandler overriding before_tool_call per DECISIONS.md.

    Note on `name`: `strands.interventions.InterventionHandler` declares `name` as an
    abstract property (required so the framework can identify handlers when several are
    registered on one `Agent(interventions=[...])`) — this was missing before and made the
    class impossible to instantiate; caught while wiring it into a real call site
    (app/strategist_operator.py's OperatorAgent) instead of only unit-testing
    check_permission() in isolation.
    """

    name = "axiom-permission-gate"

    def __init__(self, policy_table: dict[str, str]):
        super().__init__()
        self.policy_table = policy_table

    def before_tool_call(self, tool_name: str, tool_args: dict[str, Any], agent_context: Any = None):
        result = check_permission(tool_name, PermissionLevel.EXECUTE, self.policy_table)
        if not result.allowed:
            if result.requires_approval:
                raise ApprovalRequiredError(result)
            # Hard denial: no escalation path (e.g. a future explicitly-blocked action
            # type). check_permission's current policy semantics always set
            # requires_approval=True when disallowed — this branch exists so a genuine
            # hard-deny policy can be added later without changing this handler's contract.
            raise PermissionError(result.reason or "Permission denied by Axiom policy gate")
        return True
