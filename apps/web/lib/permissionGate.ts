/**
 * TS mirror of apps/agent-service/app/permission_gate.py's `check_permission` hierarchy
 * comparison. Deliberately NOT the source of truth for policy — the Permission table in
 * Postgres (owned by web, per DECISIONS.md "apps/web owns all state") is, and the real
 * enforcement point for agent tool calls is agent-service's `AxiomPermissionInterventionHandler`.
 *
 * This mirror exists only for the narrow case where web needs a gate decision for an
 * action that isn't a Strands tool call at all — e.g. deciding whether a signed contract's
 * invoice can be auto-created — without a network round trip for a pure comparison. It is
 * a deliberate, documented minimal duplication (see docs/DECISIONS.md), not a competing
 * authority: it reads the same PermissionLevel hierarchy and the same Permission rows
 * agent-service's check_permission would read. If this ever needs real agent reasoning
 * (not just a level comparison), it should go through agent-service instead.
 */

export type PermissionLevelName = "READ" | "DRAFT" | "RECOMMEND" | "EXECUTE" | "REQUIRE_APPROVAL";

const LEVEL_HIERARCHY: Record<PermissionLevelName, number> = {
  READ: 1,
  DRAFT: 2,
  RECOMMEND: 3,
  EXECUTE: 4,
  REQUIRE_APPROVAL: 5,
};

export type GateDecision = {
  allowed: boolean;
  permissionLevel: PermissionLevelName;
  actionType: string;
  reason: string | null;
  requiresApproval: boolean;
};

export function checkPermission(
  actionType: string,
  requiredLevel: PermissionLevelName,
  policyTable: Record<string, string>,
): GateDecision {
  const configuredRaw = policyTable[actionType] ?? "RECOMMEND";
  const configuredLevel: PermissionLevelName =
    configuredRaw in LEVEL_HIERARCHY ? (configuredRaw as PermissionLevelName) : "RECOMMEND";

  if (configuredLevel === "REQUIRE_APPROVAL") {
    return {
      allowed: false,
      permissionLevel: configuredLevel,
      actionType,
      reason: `Action '${actionType}' explicitly configured to REQUIRE_APPROVAL`,
      requiresApproval: true,
    };
  }

  const allowed = LEVEL_HIERARCHY[configuredLevel] >= LEVEL_HIERARCHY[requiredLevel];
  return {
    allowed,
    permissionLevel: configuredLevel,
    actionType,
    reason: allowed
      ? null
      : `Action '${actionType}' requires level ${requiredLevel}, but org level is ${configuredLevel}`,
    requiresApproval: !allowed,
  };
}
