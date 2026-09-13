"""Deterministic state & trajectory calculations — Slice 4.

Per docs/DECISIONS.md: All financial and trajectory math MUST be computed by plain,
deterministic Python functions. The LLM only narrates findings and bottlenecks.
"""

def compute_runway(cash_on_hand: int, monthly_burn: int) -> float:
    """Compute runway in months (cash / monthly_burn).

    Amounts in minor currency units (paise). Returns rounded float (2 decimals).
    Returns 999.0 if burn is zero or negative.
    """
    if monthly_burn <= 0:
        return 999.0
    return round(cash_on_hand / monthly_burn, 2)


def compute_burn_delta(current_burn: int, expense_or_sub_delta: int) -> int:
    """Compute new monthly burn given a spend delta."""
    return max(0, current_burn + expense_or_sub_delta)


def compute_goal_progress(current_val: int, target_val: int) -> float:
    """Compute percentage progress toward goal (0.0 to 100.0)."""
    if target_val <= 0:
        return 100.0
    return round(min(100.0, (current_val / target_val) * 100.0), 2)
