"""Holm over the registered family only (finding RV-DES-12; research/analysis/holm.py).

Before the guard, `holm` took m from the p-values it was given, so a
hypothesis that was not run lowered every other adjustment without a word.
These tests hold the guard: a missing, unknown or empty hypothesis is
refused, the adjustment is over five whatever is passed, and H1's interim
bound (5p) and the final Holm agree. A mutant that adjusts over four, by a
fixed 4 or by dropping a hypothesis, fails at least one of them.
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from analysis.h1 import decide_h1
from analysis.holm import HYPOTHESES, holm, interim_bound

FIVE = {"H1": 0.01, "H2": 0.04, "H3": 0.03, "H4": 0.005, "H5": 0.20}


def test_the_registered_family_is_the_five_hypotheses_of_the_pre_registration() -> None:
    assert HYPOTHESES == ("H1", "H2", "H3", "H4", "H5")


@pytest.mark.parametrize("dropped", HYPOTHESES)
def test_a_missing_hypothesis_is_refused(dropped: str) -> None:
    four = {h: p for h, p in FIVE.items() if h != dropped}
    with pytest.raises(ValueError, match="missing"):
        holm(four)


def test_an_unknown_hypothesis_is_refused() -> None:
    with pytest.raises(ValueError, match="unknown"):
        holm({**FIVE, "H6": 0.5})
    four = {h: p for h, p in FIVE.items() if h != "H5"}
    with pytest.raises(ValueError, match="unknown"):
        holm({**four, "h5": 0.2})


def test_a_hypothesis_with_no_p_value_is_refused_not_filled_in() -> None:
    with pytest.raises(ValueError, match="no p-value"):
        holm({**FIVE, "H3": None})


def test_a_hypothesis_not_run_enters_only_as_the_value_the_caller_passes() -> None:
    """Passing p = 1 explicitly for H2 to H5 leaves H1 adjusted over five: 5 x 0.01."""
    result = holm({"H1": 0.01, "H2": 1.0, "H3": 1.0, "H4": 1.0, "H5": 1.0})
    assert result["H1"].adjusted == pytest.approx(0.05)
    assert result["H1"].rejected is False


def test_the_adjustment_is_over_five_when_h1_is_the_smallest() -> None:
    """A mutant with m = 4 gives 0.04 here and rejects; over five it is 0.05, not below alpha."""
    result = holm({"H1": 0.01, "H2": 0.5, "H3": 0.6, "H4": 0.7, "H5": 0.8})
    assert result["H1"].adjusted == pytest.approx(0.05)
    assert not result["H1"].rejected


def test_the_interim_bound_is_five_p_capped_at_one() -> None:
    assert interim_bound(0.009) == pytest.approx(0.045)
    assert interim_bound(0.3) == 1.0
    with pytest.raises(ValueError):
        interim_bound(1.5)


p_value = st.floats(min_value=0.0, max_value=1.0, allow_nan=False)


@settings(max_examples=500, deadline=None, derandomize=True)
@given(p=p_value, others=st.lists(p_value, min_size=4, max_size=4))
def test_h1s_final_holm_lies_between_p_and_the_interim_bound(p: float, others: list[float]) -> None:
    """Whatever H2 to H5 give, p <= adjusted <= 5p, with 5p attained when H1 is the smallest."""
    family = {"H1": p, **dict(zip(HYPOTHESES[1:], others, strict=True))}
    adjusted = holm(family)["H1"].adjusted
    assert p - 1e-12 <= adjusted <= interim_bound(p) + 1e-12
    if all(p < o for o in others):
        assert adjusted == pytest.approx(interim_bound(p))


@settings(max_examples=500, deadline=None, derandomize=True)
@given(p=p_value, others=st.lists(p_value, min_size=4, max_size=4))
def test_the_interim_read_out_never_disagrees_with_the_final_one(
    p: float, others: list[float]
) -> None:
    """A bound that decides (supported, not supported) is what Holm over five later decides."""
    interim, _ = decide_h1(p, None, None)
    final, _ = decide_h1(p, dict(zip(HYPOTHESES[1:], others, strict=True)), None)
    if interim["primary"] != "undecided":
        assert final["primary"] == interim["primary"]


# Review fix pass (PR #57): X4-5 and the NaN secondary bound.

NOT_FINITE = [float("nan"), float("inf"), float("-inf")]


@pytest.mark.parametrize("bad", NOT_FINITE)
def test_holm_refuses_a_p_value_that_is_not_finite(bad: float) -> None:
    with pytest.raises(ValueError):
        holm({**FIVE, "H3": bad})


@pytest.mark.parametrize("bad", NOT_FINITE)
def test_the_interim_bound_refuses_a_p_value_that_is_not_finite(bad: float) -> None:
    with pytest.raises(ValueError):
        interim_bound(bad)


@pytest.mark.parametrize("bad", NOT_FINITE)
def test_decide_h1_refuses_a_secondary_bound_that_is_not_finite(bad: float) -> None:
    """A NaN interval end would read as "does not contradict"; it is refused instead."""
    with pytest.raises(ValueError, match="secondary"):
        decide_h1(0.001, None, bad)
