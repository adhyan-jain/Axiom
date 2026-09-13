import pytest
from app.trajectory import compute_runway, compute_burn_delta, compute_goal_progress

def test_compute_runway():
    # ₹18L cash, ₹2.6L burn => ~6.92 months
    assert compute_runway(180000000, 26000000) == 6.92
    assert compute_runway(1000, 0) == 999.0

def test_compute_burn_delta():
    # ₹260k + ₹33k spike => ₹293k
    assert compute_burn_delta(26000000, 3300000) == 29300000

def test_compute_goal_progress():
    # ₹2.4L of ₹10L => 24.0%
    assert compute_goal_progress(24000000, 100000000) == 24.0
