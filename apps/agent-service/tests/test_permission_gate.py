import pytest
from app.permission_gate import (
    check_permission,
    AxiomPermissionInterventionHandler,
    ApprovalRequiredError,
    GateCheckResult,
    PermissionLevel,
)

def test_check_permission_allowed():
    policy = {"create_invoice": "EXECUTE"}
    res = check_permission("create_invoice", PermissionLevel.EXECUTE, policy)
    assert res.allowed is True
    assert res.requires_approval is False

def test_check_permission_require_approval():
    policy = {"modify_contract": "REQUIRE_APPROVAL"}
    res = check_permission("modify_contract", PermissionLevel.EXECUTE, policy)
    assert res.allowed is False
    assert res.requires_approval is True


def test_before_tool_call_allows_sufficiently_permissioned_action():
    handler = AxiomPermissionInterventionHandler({"create_invoice": "EXECUTE"})
    assert handler.before_tool_call("create_invoice", {"amount": 20000000}) is True


def test_before_tool_call_raises_approval_required_for_require_approval_policy():
    handler = AxiomPermissionInterventionHandler({"modify_contract": "REQUIRE_APPROVAL"})
    with pytest.raises(ApprovalRequiredError) as exc_info:
        handler.before_tool_call("modify_contract", {"contractId": "c1"})
    assert exc_info.value.gate_result.requires_approval is True
    assert exc_info.value.gate_result.action_type == "modify_contract"


def test_before_tool_call_raises_approval_required_for_insufficient_level():
    # Under the current policy semantics, insufficient-level denials also escalate to
    # approval rather than hard-denying (see DECISIONS.md — authority never silently
    # lapses; the founder should always get a chance to approve, not a silent block).
    handler = AxiomPermissionInterventionHandler({"cancel_subscription": "READ"})
    with pytest.raises(ApprovalRequiredError):
        handler.before_tool_call("cancel_subscription", {})


def test_before_tool_call_raises_plain_permission_error_for_hard_denial(monkeypatch):
    # Exercise the hard-denial branch directly: monkeypatch check_permission to return a
    # disallowed-and-not-escalatable result (not reachable via today's policy table values,
    # but the handler must still route it to PermissionError, not ApprovalRequiredError, if
    # a future policy type produces one).
    import app.permission_gate as permission_gate_module

    def fake_check_permission(action_type, required_level, policy_table):
        return GateCheckResult(
            allowed=False,
            permission_level=PermissionLevel.READ,
            action_type=action_type,
            reason="Blocked by hypothetical hard-deny policy",
            requires_approval=False,
        )

    monkeypatch.setattr(permission_gate_module, "check_permission", fake_check_permission)
    handler = AxiomPermissionInterventionHandler({"some_action": "READ"})
    with pytest.raises(PermissionError):
        handler.before_tool_call("some_action", {})
