import pytest
from app.permission_gate import check_permission, PermissionLevel

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
