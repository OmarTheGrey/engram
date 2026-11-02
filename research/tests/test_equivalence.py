"""H4's equivalence test (research/analysis/equivalence.py), tested before it sees data.

Review findings this file answers: the TOST must hold its level with the true
difference on the margin (first round, P2-1; second round, V2), its decision
must be monotone in the evidence (V1), its p-value must sit on the scale of
the other primary p-values so it can enter Holm (V3), and a per-side level of
alpha instead of alpha / 2 must fail a level test (V6).
"""

from __future__ import annotations

import math
from statistics import NormalDist

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from analysis.equivalence import critical_z, equivalent_from_sums, tost
from analysis.h1 import decide_h1
from analysis.holm import holm
from analysis.power import SEED_MODELS, SeedModel, exact_level, simulated_level

PHI = NormalDist().cdf


def thirds(counts: dict[int, int]) -> np.ndarray:
    """A sample of item-level differences: `counts[j]` items at j / 3."""
    return np.concatenate([np.full(c, j / 3) for j, c in sorted(counts.items())])


# The decision and its p-value.


def test_equivalence_is_found_well_inside_the_margin() -> None:
    d = thirds({-1: 40, 0: 920, 1: 40})
    result = tost(d, margin=0.05)
    assert result.equivalent and result.p < 0.05


def test_equivalence_is_refused_when_the_difference_reaches_the_margin() -> None:
    d = thirds({-3: 60, 0: 940})  # mean -0.06
    result = tost(d, margin=0.05)
    assert not result.equivalent and result.p_lower > 0.5


def test_the_p_value_is_twice_the_larger_one_sided_p_value_and_decides_at_any_alpha() -> None:
    """Equivalence at level a exactly when p < a: the scale of the other primary p-values."""
    d = thirds({-1: 30, 0: 400, 1: 22})
    result = tost(d, margin=0.05)
    assert result.p_lower == pytest.approx(1 - PHI(result.z_lower))
    assert result.p_upper == pytest.approx(1 - PHI(result.z_upper))
    assert result.p == pytest.approx(min(1.0, 2 * max(result.p_lower, result.p_upper)))
    for alpha in (0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2):
        assert tost(d, margin=0.05, alpha=alpha).equivalent == (result.p < alpha)


def test_each_side_is_held_to_half_of_alpha() -> None:
    assert critical_z(0.05) == pytest.approx(NormalDist().inv_cdf(0.975))
    assert critical_z(0.01) == pytest.approx(NormalDist().inv_cdf(0.995))


def test_h4s_p_value_enters_holm_on_the_scale_of_the_others() -> None:
    """Holm rejects H4 at family-wise 0.05 exactly when the TOST passes at Holm's threshold."""
    d = thirds({-1: 12, 0: 900, 1: 15})
    p4 = tost(d, margin=0.05).p
    others = {"H2": 0.2, "H3": 0.3, "H4": p4, "H5": 0.4}
    result = holm({"H1": 0.5, **others})
    # H4 is the smallest of the five, so its threshold is 0.05 / 5.
    assert min(others.values()) == p4
    assert result["H4"].rejected == tost(d, margin=0.05, alpha=0.01).equivalent
    assert result["H4"].rejected
    # Through decide_h1: H1's Holm-adjusted value is computed with H4's TOST p-value.
    _, holm_part = decide_h1(0.03, others, None)
    expected = holm({"H1": 0.03, **others})["H1"].adjusted
    assert holm_part["adjusted"] == pytest.approx(expected)


def test_a_pair_with_no_discordant_item_needs_the_floor_s_number_of_items() -> None:
    """With no item differing, z = sqrt(n margin / (1 - margin)): pass from z above z(0.975)."""
    for margin in (0.02, 0.05, 0.10):
        bound = critical_z(0.05) ** 2 * (1 - margin) / margin
        short, enough = math.floor(bound), math.floor(bound) + 1
        assert not tost(np.zeros(short), margin=margin).equivalent
        assert tost(np.zeros(enough), margin=margin).equivalent


def test_the_decision_from_sums_is_the_decision_from_the_sample() -> None:
    rng = np.random.default_rng(3)
    for _ in range(200):
        d = rng.integers(-3, 4, size=int(rng.integers(20, 400))) / 3
        d[rng.random(d.size) < 0.8] = 0.0
        for alpha in (0.05, 0.01):
            via_sums = bool(
                equivalent_from_sums(
                    np.array([d.sum()]), np.array([(d * d).sum()]), d.size, 0.05, alpha
                )[0]
            )
            assert via_sums == tost(d, margin=0.05, alpha=alpha).equivalent


# Monotone in the evidence (review finding V1).


def test_more_disagreement_with_the_same_mean_never_turns_a_refusal_into_equivalence() -> None:
    """The review's case: 761 items, 2 points, k items at -1/3 and k at +1/3."""
    decisions = [
        tost(thirds({-1: k, 0: 761 - 2 * k, 1: k}), margin=0.02).equivalent for k in range(381)
    ]
    first_refusal = decisions.index(False)
    assert all(decisions[:first_refusal]) and not any(decisions[first_refusal:])


lattice = st.lists(st.integers(min_value=-3, max_value=3), min_size=20, max_size=400)


@settings(max_examples=300, deadline=None, derandomize=True)
@given(values=lattice, margin=st.sampled_from([0.02, 0.05, 0.1]))
def test_a_mean_preserving_contraction_never_raises_the_p_value(
    values: list[int], margin: float
) -> None:
    """Moving a pair of opposite-signed items one third towards each other keeps the mean."""
    d = np.array(values, dtype=float) / 3
    low, high = int(np.argmin(d)), int(np.argmax(d))
    if d[high] - d[low] < 2 / 3:
        return
    contracted = d.copy()
    contracted[low] += 1 / 3
    contracted[high] -= 1 / 3
    assert contracted.mean() == pytest.approx(d.mean())
    assert tost(contracted, margin=margin).p <= tost(d, margin=margin).p + 1e-12


@settings(max_examples=300, deadline=None, derandomize=True)
@given(values=lattice, margin=st.sampled_from([0.02, 0.05, 0.1]))
def test_equivalence_at_k_disagreeing_pairs_implies_equivalence_at_k_minus_1(
    values: list[int], margin: float
) -> None:
    """Remove one +1/3 and one -1/3 (replace both with 0): equivalence is kept."""
    d = np.array(values, dtype=float) / 3
    plus, minus = np.flatnonzero(d == 1 / 3), np.flatnonzero(d == -1 / 3)
    if plus.size == 0 or minus.size == 0:
        return
    fewer = d.copy()
    fewer[plus[0]] = 0.0
    fewer[minus[0]] = 0.0
    if tost(d, margin=margin).equivalent:
        assert tost(fewer, margin=margin).equivalent


# The level with the true difference on the margin (review findings P2-1, V2, V6).


@pytest.mark.parametrize("margin", [0.02, 0.05, 0.10])
@pytest.mark.parametrize("seed_model", SEED_MODELS)
@pytest.mark.parametrize("alpha", [0.05, 0.01])
def test_the_exact_level_at_kappa_0_is_at_most_alpha(
    margin: float, seed_model: SeedModel, alpha: float
) -> None:
    """Kappa 0, one arm a margin above the other: computed exactly over a grid of sizes."""
    worst = max(
        exact_level(margin, n, seed_model, alpha=alpha)
        for n in range(int(20 / margin), int(200 / margin), int(4 / margin))
    )
    assert worst <= alpha


def test_the_exact_level_agrees_with_simulation() -> None:
    for seed_model in SEED_MODELS:
        exact = exact_level(0.1, 60, seed_model, alpha=0.2)
        simulated = simulated_level(0.0, 0.1, 60, 0.0, seed_model, runs=40_000, seed=11, alpha=0.2)
        assert simulated == pytest.approx(exact, abs=4 * math.sqrt(exact * (1 - exact) / 40_000))


LEVEL_RUNS = 4_000


@pytest.mark.parametrize(
    ("rate", "margin", "kappa", "seed_model", "items"),
    [
        # Skewed counts at the margin: one arm rarely violates where the other does not.
        (0.02, 0.10, 1.0, "identical", 200),
        (0.02, 0.10, 0.1, "identical", 120),
        (0.10, 0.05, 0.1, "identical", 600),
        (0.02, 0.05, 1.0, "independent", 400),
        (0.10, 0.02, 0.05, "independent", 2_000),
    ],
)
def test_the_simulated_level_on_the_margin_is_below_alpha_by_two_standard_errors(
    rate: float, margin: float, kappa: float, seed_model: SeedModel, items: int
) -> None:
    """Either way round; a per-side level of alpha (not alpha / 2) fails these cases."""
    level = simulated_level(rate, margin, items, kappa, seed_model, runs=LEVEL_RUNS, seed=20261102)
    assert level + 2 * math.sqrt(0.05 * 0.95 / LEVEL_RUNS) <= 0.05
