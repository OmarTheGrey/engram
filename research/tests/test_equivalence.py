"""H4's equivalence test (research/analysis/equivalence.py), tested before it sees data.

Review findings this file answers: the TOST must hold its level with the true
difference on the margin (first round, P2-1; second round, V2; third round,
R2-1 and R2-2, over the whole composite null, by the exact lattice levels of
research/analysis/power.py), its decision must be monotone in the evidence
(V1; R2-4, on every point of the lattice), its p-value must sit on the scale
of the other primary p-values so it can enter Holm (V3; R2-3, at the
threshold), H4's one p-value is the intersection-union p over its pairs, and
a per-side level of alpha instead of alpha / 2 must fail a level test (V6).
"""

from __future__ import annotations

import math
from itertools import combinations_with_replacement
from statistics import NormalDist

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from scipy.optimize import minimize  # type: ignore[import-untyped]  # no type stubs

from analysis.equivalence import critical_z, equivalent_from_sums, intersection_union_p, tost
from analysis.h1 import decide_h1
from analysis.holm import holm
from analysis.power import (
    LATTICE,
    SEED_MODELS,
    SeedModel,
    composite_sup,
    difference_distribution,
    exact_level,
    lattice_level,
    lattice_level_gradient,
    on_margin,
    simulated_level,
    three_point,
    three_point_level,
)

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


def test_h4s_p_value_between_the_one_sided_and_the_two_sided_threshold_is_not_rejected() -> None:
    """114 items, none disagreeing, margin 0.05: p = 2 (1 - Phi(sqrt 6)) = 0.0143 (R2-3).

    Both sides have z = 0.05 / sqrt(0.0475 / 114) = sqrt 6. As the smallest of
    five, H4 meets Holm's threshold 0.05 / 5 = 0.01, which the TOST at 0.01
    refuses; a p on the one-sided scale (0.0072) would be rejected.
    """
    d = np.zeros(114)
    p4 = tost(d, margin=0.05).p
    assert p4 == pytest.approx(0.0143058784, abs=1e-9)
    assert not tost(d, margin=0.05, alpha=0.01).equivalent
    others = {"H2": 0.2, "H3": 0.3, "H4": p4, "H5": 0.4}
    result = holm({"H1": 0.5, **others})
    assert result["H4"].adjusted == pytest.approx(0.0715293922, abs=1e-9)
    assert not result["H4"].rejected
    # Through decide_h1, by hand: H4 first (5 x 0.0143 = 0.0715), then H1 (4 x 0.016 = 0.064),
    # so H1's adjusted value is the running maximum, 0.0715, H4's.
    decision, holm_part = decide_h1(0.016, others, None)
    assert holm_part["adjusted"] == pytest.approx(0.0715293922, abs=1e-9)
    assert decision["primary"] == "not supported"


def test_h4s_intersection_union_p_is_the_largest_pair_p_and_decides_with_every_pair() -> None:
    """Two families of three pairs; H4 holds at alpha exactly when every pair is equivalent."""
    pairs = [(10, 12), (12, 15), (8, 20), (15, 15), (5, 25), (11, 11)]
    results = [tost(thirds({-1: a, 0: 900, 1: b}), margin=0.05) for a, b in pairs]
    p4 = intersection_union_p(results)
    assert p4 == max(r.p for r in results)
    for alpha in (0.001, 0.005, 0.01, 0.02, 0.05, 0.1):
        every = all(
            tost(r_d, margin=0.05, alpha=alpha).equivalent
            for r_d in (thirds({-1: a, 0: 900, 1: b}) for a, b in pairs)
        )
        assert (p4 < alpha) == every
    # Through Holm, H4 the largest of five: its threshold is 0.05 itself.
    small = {"H1": 0.001, "H2": 0.002, "H3": 0.003, "H5": 0.004}
    assert holm({**small, "H4": p4})["H4"].rejected == (p4 < 0.05)
    worse = [*results, tost(thirds({-3: 60, 0: 940}), margin=0.05)]  # mean -0.06
    assert not holm({**small, "H4": intersection_union_p(worse)})["H4"].rejected
    with pytest.raises(ValueError):
        intersection_union_p([])


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


@pytest.mark.parametrize("margin", [0.02, 0.05, 0.10])
@pytest.mark.parametrize("alpha", [0.05, 0.01])
def test_on_every_point_of_the_lattice_passing_never_resumes(margin: float, alpha: float) -> None:
    """Every (3 sum d, 9 sum d^2) with 9 n sum d^2 at least (3 sum d)^2 (review finding R2-4).

    At a fixed sum, once the TOST refuses it refuses at every larger sum of
    squares; at a fixed sum of squares, once it refuses it refuses at every
    sum further from zero.
    """
    seen_both = False
    for n in (20, 57, 114, 200, 381):
        t = np.arange(-3 * n, 3 * n + 1)[:, None]
        q = np.arange(0, 9 * n + 1)[None, :]
        possible = q * n >= t * t
        total, squares = np.broadcast_arrays(t / 3.0, q / 9.0)
        passed = equivalent_from_sums(total, squares, n, margin, alpha).astype(np.int8)
        seen_both = seen_both or bool(passed[possible].any() and not passed[possible].all())
        both = possible[:, 1:] & possible[:, :-1]
        assert (np.diff(passed, axis=1)[both] <= 0).all()  # more squares at one sum
        up = 3 * n  # the row of sum 0
        outward = possible[up + 1 :] & possible[up:-1]
        assert (np.diff(passed[up:], axis=0)[outward] <= 0).all()  # sums above zero
        inward = possible[: up + 1][::-1]
        towards = inward[1:] & inward[:-1]
        assert (np.diff(passed[: up + 1][::-1], axis=0)[towards] <= 0).all()  # below zero
    assert seen_both  # some sizes both pass and refuse: the test is not vacuous


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


def every_count_vector_level(n: int, margin: float, alpha: float, probs: np.ndarray) -> float:
    """The level summed over every count vector of n items on the seven values: the oracle."""
    counts = np.array(
        [np.bincount(c, minlength=7) for c in combinations_with_replacement(range(7), n)]
    )
    with np.errstate(divide="ignore"):
        log_probs = np.log(probs)
    weights = np.where(counts > 0, counts * log_probs, 0.0).sum(axis=1)
    log_mass = (
        math.lgamma(n + 1) - np.array([sum(math.lgamma(c + 1) for c in row) for row in counts])
    ) + weights
    passed = equivalent_from_sums(
        counts @ (LATTICE / 3.0), counts @ (LATTICE**2 / 9.0), n, margin, alpha
    )
    return float(np.exp(log_mass)[passed].sum())


def test_the_lattice_level_equals_the_sum_over_every_count_vector() -> None:
    rng = np.random.default_rng(4)
    for _ in range(3):
        probs = on_margin(rng.dirichlet(np.full(7, 0.5)), 0.25)
        oracle = every_count_vector_level(14, 0.25, 0.3, probs)
        assert oracle > 0.01
        assert lattice_level(14, 0.25, 0.3, probs) == pytest.approx(oracle, abs=1e-12)


def test_the_lattice_level_equals_the_trinomial_and_the_kappa_0_sums() -> None:
    for a, b, share in ((-3, 1, 0.058), (-2, 3, 0.01), (-3, 3, 0.2), (-1, 2, 0.0)):
        expected = three_point_level(381, 0.05, 0.01, a, b, share)
        got = lattice_level(381, 0.05, 0.01, three_point(a, b, share, 0.05))
        assert got == pytest.approx(expected, abs=1e-10)
    for model in SEED_MODELS:
        kappa_0 = difference_distribution((0.1, 0.15), 0.0, model)
        expected = exact_level(0.05, 381, model, alpha=0.05)
        assert lattice_level(381, 0.05, 0.05, kappa_0) == pytest.approx(expected, abs=1e-10)


def test_the_lattice_level_agrees_with_simulation_on_a_skewed_seven_point_null() -> None:
    probs = on_margin([0.07, 0.002, 0.004, 0.86, 0.06, 0.004, 0.0], 0.05)
    exact = lattice_level(300, 0.05, 0.05, probs)
    rng = np.random.default_rng(12)
    counts = rng.multinomial(300, probs, size=200_000)
    passed = equivalent_from_sums(
        counts @ (LATTICE / 3.0), counts @ (LATTICE**2 / 9.0), 300, 0.05, 0.05
    )
    error = math.sqrt(exact * (1 - exact) / 200_000)
    assert float(passed.mean()) == pytest.approx(exact, abs=4 * error)


def test_the_level_gradient_is_the_derivative_of_the_level() -> None:
    """The level extended to unnormalised weights is homogeneous of degree n."""
    n, margin, alpha = 60, 0.1, 0.2
    probs = on_margin([0.12, 0.01, 0.03, 0.7, 0.12, 0.02, 0.005], margin)

    def extended(weights: np.ndarray) -> float:
        total = float(weights.sum())
        return lattice_level(n, margin, alpha, weights / total) * total**n

    level, gradient = lattice_level_gradient(n, margin, alpha, probs)
    assert level == pytest.approx(lattice_level(n, margin, alpha, probs), abs=1e-12)
    for k in range(7):
        step = np.zeros(7)
        step[k] = 1e-6
        slope = (extended(probs + step) - extended(probs - step)) / 2e-6
        assert gradient[k] == pytest.approx(slope, rel=1e-5, abs=1e-8)


SUP_CASES = [(113, 0.10, 0.05), (381, 0.05, 0.01)]


@pytest.mark.parametrize(("items", "margin", "alpha"), SUP_CASES)
def test_no_identical_seed_null_on_the_whole_boundary_exceeds_the_composite_sup(
    items: int, margin: float, alpha: float
) -> None:
    """d in {-1, 0, 1} with mean -margin: P(d = 1) over 400 values from 0 to its largest."""
    sup = composite_sup(items, margin, alpha)["level"]
    top = (1 - margin) / 2
    for share in np.concatenate([np.linspace(0.0, top, 300), np.geomspace(1e-6, top, 100)]):
        assert three_point_level(items, margin, alpha, -3, 3, float(share)) <= sup + 1e-9


@pytest.mark.parametrize(("items", "margin", "alpha"), SUP_CASES)
def test_no_random_lattice_null_exceeds_the_composite_sup(
    items: int, margin: float, alpha: float
) -> None:
    """Sixty random nulls on all seven values, and climbs from three of them, each level exact."""
    found = composite_sup(items, margin, alpha)
    probs = np.array(found["probs"])
    assert probs.sum() == pytest.approx(1.0, abs=1e-8)
    assert float(probs @ LATTICE) / 3 == pytest.approx(-margin, abs=1e-8)
    exact = lattice_level(items, margin, alpha, on_margin(probs, margin))
    assert exact <= found["level"] < exact + 1e-6  # rounded up to the results' six decimals
    rng = np.random.default_rng(items)
    nulls = [
        on_margin(rng.dirichlet(np.full(7, rng.choice([0.1, 0.3, 1.0]))), margin) for _ in range(60)
    ]
    for null in nulls:
        assert lattice_level(items, margin, alpha, null) <= found["level"] + 1e-9
    constraints = (
        {"type": "eq", "fun": lambda p: p.sum() - 1.0},
        {"type": "eq", "fun": lambda p: p @ LATTICE / 3.0 + margin},
    )

    def objective(x: np.ndarray) -> tuple[float, np.ndarray]:
        level, gradient = lattice_level_gradient(items, margin, alpha, on_margin(x, margin))
        return -level, -gradient

    for null in nulls[:3]:
        climbed = minimize(
            objective,
            null,
            jac=True,
            method="SLSQP",
            bounds=[(0.0, 1.0)] * 7,
            constraints=constraints,
            options={"maxiter": 200, "ftol": 1e-12},
        )
        top = lattice_level(items, margin, alpha, on_margin(climbed.x, margin))
        assert top <= found["level"] + 1e-9


def test_at_small_sizes_the_composite_sup_exceeds_alpha_where_kappa_0_does_not() -> None:
    """Why the gate searches the composite null: the kappa-0 levels alone pass 190 items."""
    assert composite_sup(190, 0.05, 0.01)["level"] > 0.01
    assert max(exact_level(0.05, 190, m, alpha=0.01) for m in SEED_MODELS) < 0.01


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
