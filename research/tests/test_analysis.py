"""The pre-registration's Statistics section, tested before it sees real data.

docs/research/preregistration.md (Statistics) and plan decision 3 of
docs/tasks/prereg-v1-plan.md: a paired bootstrap of the mean difference with
10,000 resamples, BCa, 95 percent; the one-sided p-value as the share of
resamples at or below zero; Holm over the five primary p-values at 0.05; seeds
averaged within an item before resampling; two one-sided tests for H4; Wilson
95 percent intervals for the Gate C table. docs/conventions/testing.md asks for
a planted effect recovered and a planted null held near its nominal rate.

Every simulation takes its seed from the test (AGENTS.md rule 6).
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import NormalDist
from typing import Any

import numpy as np
import pytest
from scipy import stats  # type: ignore[import-untyped]  # scipy ships no type stubs

from analysis import (
    RESAMPLES,
    bca_interval,
    build_h1_table,
    holm,
    item_means,
    paired_bootstrap,
    paired_differences,
    read_sessions,
    resample_means,
    tost,
    wilson,
)
from analysis.h1 import H1Config, SchemaError, decide_h1


def sessions_for(
    rng: np.random.Generator, items: int, rate: float, seeds: int = 3
) -> list[tuple[str, int, float | None]]:
    """Binary violation outcomes, one per (item, seed), independent at `rate`."""
    draws = rng.random((items, seeds)) < rate
    return [
        (f"item-{i:04d}", s + 1, float(draws[i, s])) for i in range(items) for s in range(seeds)
    ]


def planted_differences(seed: int, items: int, rate_a: float, rate_b: float) -> np.ndarray:
    """Item-level differences A minus B, seeds averaged within each item."""
    rng = np.random.default_rng(seed)
    a = item_means(sessions_for(rng, items, rate_a))
    b = item_means(sessions_for(rng, items, rate_b))
    return paired_differences(a, b)[1]


# The paired bootstrap.


def test_seeds_are_averaged_within_an_item_and_excluded_sessions_count_for_nothing() -> None:
    means = item_means(
        [("x", 1, 1.0), ("x", 2, 0.0), ("x", 3, 1.0), ("y", 1, None), ("y", 2, 0.0), ("z", 1, None)]
    )
    assert means == {"x": pytest.approx(2 / 3), "y": 0.0}


def test_a_repeated_item_and_seed_is_refused() -> None:
    with pytest.raises(ValueError, match="twice"):
        item_means([("x", 1, 1.0), ("x", 1, 0.0)])


def test_differences_pair_items_present_under_both_conditions_in_item_order() -> None:
    items, diffs = paired_differences({"b": 1.0, "a": 0.5, "c": 1.0}, {"a": 0.0, "b": 1.0})
    assert items == ["a", "b"]
    assert diffs.tolist() == [0.5, 0.0]


def test_resampling_draws_items_with_replacement() -> None:
    """The multinomial over distinct values has the bootstrap's moments: mean d, variance s2/n."""
    values = np.array([0.0] * 60 + [1 / 3] * 25 + [1.0] * 15)
    means = resample_means(values, resamples=RESAMPLES, rng=np.random.default_rng(20261102))
    plug_in_sd = float(np.sqrt(values.var() / values.size))
    assert abs(float(means.mean()) - float(values.mean())) < 4 * plug_in_sd / np.sqrt(RESAMPLES)
    assert float(means.std()) == pytest.approx(plug_in_sd, rel=0.03)


def test_a_planted_effect_is_recovered_with_the_nominal_coverage() -> None:
    """C4 at 30 percent, C5 at 10 percent: the 95 percent interval covers 0.20 about 95 in 100."""
    truth = 0.20
    covered = 0
    rejected = 0
    runs = 200
    for run in range(runs):
        diffs = planted_differences(1_000 + run, items=300, rate_a=0.30, rate_b=0.10)
        result = paired_bootstrap(diffs, seed=50_000 + run)
        assert result.method == "BCa"
        covered += result.low <= truth <= result.high
        rejected += result.p_one_sided < 0.05
    assert 0.90 <= covered / runs <= 0.99
    assert rejected == runs


def test_a_planted_null_holds_the_one_sided_rejection_rate_near_its_level() -> None:
    """C4 and C5 both at 15 percent: p below 0.05 in about 5 percent of 1,000 seeded runs."""
    runs = 1_000
    rejected = sum(
        paired_bootstrap(
            planted_differences(2_000 + run, items=200, rate_a=0.15, rate_b=0.15),
            seed=60_000 + run,
        ).p_one_sided
        < 0.05
        for run in range(runs)
    )
    # About three standard errors either side of 0.05 at 1,000 runs.
    assert 0.03 <= rejected / runs <= 0.07


THIRDS = np.array([-1, 0, 0, 1, 2, 0, -2, 1, 0, 3, -1, 0, 1, 0, -3, 2]) / 3


def exact_resample_sums(values_in_thirds: np.ndarray, seed: int) -> np.ndarray:
    """Each resample's sum, in thirds and in integers: resample_means's draws, unrounded."""
    distinct, counts = np.unique(values_in_thirds, return_counts=True)
    draws = np.random.default_rng(seed).multinomial(
        values_in_thirds.size, counts / values_in_thirds.size, size=RESAMPLES
    )
    sums: np.ndarray = draws @ np.rint(distinct * 3).astype(np.int64)
    return sums


def test_the_p_value_is_the_share_of_resamples_at_or_below_zero_in_exact_arithmetic() -> None:
    """Resamples whose mean is zero only up to rounding still count as at or below zero."""
    result = paired_bootstrap(THIRDS, seed=7)
    sums = exact_resample_sums(THIRDS, seed=7)
    assert np.count_nonzero(sums == 0) > 500  # many resamples sit exactly on zero
    assert result.p_one_sided == float(np.mean(sums <= 0))
    assert result.resamples == RESAMPLES == 10_000


def test_tost_p_values_are_shares_at_or_beyond_each_margin_in_exact_arithmetic() -> None:
    """The margin 1/16 is itself a resample mean of these sixteen thirds (3/48)."""
    margin = 1 / 16
    result = tost(THIRDS, margin=margin, seed=5)
    sums = exact_resample_sums(THIRDS, seed=5)
    # mean = sums / (3 * 16); at or below -1/16 is sums <= -3.
    assert result.p_lower == float(np.mean(sums <= -3))
    assert result.p_upper == float(np.mean(sums >= 3))


def test_identical_differences_are_reported_as_degenerate_not_as_a_nan_interval() -> None:
    result = paired_bootstrap(np.zeros(40), seed=1)
    assert result.method == "degenerate"
    assert (result.low, result.high, result.mean) == (0.0, 0.0, 0.0)
    assert result.p_one_sided == 1.0
    assert result.z0 is None and result.acceleration is None


def test_resampling_needs_a_seed() -> None:
    with pytest.raises(TypeError):
        paired_bootstrap(np.ones(3))  # type: ignore[call-arg]


# BCa against the reference implementation
# (docs/readings/litreview/methods-efron-tibshirani-bootstrap.md).

KNOWN_SAMPLE = np.array(
    [
        *[0.0, 0.0, 1.0, 0.0, 2 / 3, 0.0, 1 / 3, 0.0, 1.0, 0.0, 0.0, 1 / 3, 0.0, 0.0, 1.0],
        *[0.0, -1 / 3, 0.0, 2 / 3, 0.0, 0.0, 1.0, 0.0, 0.0, 1 / 3, 0.0, 0.0, 1.0, 0.0, 0.0],
    ]
)
# Thirty lognormal quantiles: right-skewed, and no two resamples share a mean, so
# scipy's exact comparisons and this module's tolerant ones count the same ties (none).
LOGNORMAL_SAMPLE = np.exp(np.array([NormalDist().inv_cdf((i + 0.5) / 30) for i in range(30)]))


def scipy_bca(sample: np.ndarray, seed: int, resamples: int) -> Any:
    return stats.bootstrap(
        (sample,),
        np.mean,
        n_resamples=resamples,
        method="BCa",
        confidence_level=0.95,
        rng=np.random.default_rng(seed),
    )


def test_bca_endpoints_equal_scipy_on_the_same_bootstrap_distribution() -> None:
    """Fed scipy's own resamples, the BCa formula gives scipy's interval to rounding."""
    reference = scipy_bca(LOGNORMAL_SAMPLE, seed=20261102, resamples=RESAMPLES)
    low, high, z0, acceleration = bca_interval(
        LOGNORMAL_SAMPLE, reference.bootstrap_distribution, confidence=0.95
    )
    assert low == pytest.approx(reference.confidence_interval.low, abs=1e-12)
    assert high == pytest.approx(reference.confidence_interval.high, abs=1e-12)
    assert acceleration > 0.01  # a skewed sample, so BCa moves the endpoints
    assert z0 != 0.0


def test_ties_at_the_observed_mean_count_half_below_even_when_rounding_splits_them() -> None:
    """z0 is the normal quantile of (below + ties / 2) / B, ties found within the tolerance."""
    values = np.array([0.0, 0.0, 1 / 3, 1.0])
    theta = float(values.mean())
    # 30 below, 40 tying (some a few ulps off, as a different summation order gives), 30 above.
    ties = theta + np.array([0.0, 1e-16, -1e-16, 2e-16] * 10)
    star = np.concatenate([np.full(30, theta - 0.2), ties, np.full(30, theta + 0.2)])
    z0 = bca_interval(values, star, confidence=0.95)[2]
    assert z0 == pytest.approx(NormalDist().inv_cdf((30 + 40 / 2) / 100), abs=1e-12)


# Right-skewed, so BCa moves the upper endpoint by about a fifth of the interval's width.
SKEWED_SAMPLE = np.array([0.0] * 12 + [0.05, 0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.3, 2.1])


def test_the_paired_bootstrap_agrees_with_scipy_within_monte_carlo_error() -> None:
    """Our resampling at 10,000 against scipy's BCa at 200,000 resamples, on a skewed sample."""
    ours = paired_bootstrap(SKEWED_SAMPLE, seed=11)
    reference = scipy_bca(SKEWED_SAMPLE, seed=12, resamples=200_000)
    width = reference.confidence_interval.high - reference.confidence_interval.low
    assert ours.low == pytest.approx(reference.confidence_interval.low, abs=0.05 * width)
    assert ours.high == pytest.approx(reference.confidence_interval.high, abs=0.05 * width)
    # The test can tell BCa from the percentile interval: they differ by more than the tolerance.
    assert abs(ours.percentile_high - ours.high) > 0.10 * width


def test_the_acceleration_is_the_jackknife_skewness_of_efron_and_tibshirani_eq_14_15() -> None:
    """Checked against a direct leave-one-out loop over the raw values."""
    sample = KNOWN_SAMPLE
    jack = np.array([np.delete(sample, i).mean() for i in range(sample.size)])
    u = jack.mean() - jack
    expected = float((u**3).sum() / (6 * (u**2).sum() ** 1.5))
    star = resample_means(sample, resamples=RESAMPLES, rng=np.random.default_rng(3))
    assert bca_interval(sample, star, confidence=0.95)[3] == pytest.approx(expected, abs=1e-12)


# Holm (Holm 1979; docs/readings/litreview/methods-holm-1979.md).


def test_holm_on_the_hand_case_of_the_reading_note() -> None:
    """Wikipedia's example in the note: adjusted 0.03, 0.06, 0.06, 0.02; one and four rejected."""
    result = holm({"H1": 0.01, "H2": 0.04, "H3": 0.03, "H4": 0.005})
    assert {h: r.adjusted for h, r in result.items()} == pytest.approx(
        {"H1": 0.03, "H2": 0.06, "H3": 0.06, "H4": 0.02}
    )
    assert [h for h, r in result.items() if r.rejected] == ["H1", "H4"]


def test_holm_over_five_hypotheses_by_hand() -> None:
    """Sorted 0.005, 0.01, 0.03, 0.04, 0.20 times 5, 4, 3, 2, 1, with the running maximum."""
    result = holm({"H1": 0.01, "H2": 0.04, "H3": 0.03, "H4": 0.005, "H5": 0.20})
    assert {h: r.adjusted for h, r in result.items()} == pytest.approx(
        {"H1": 0.04, "H2": 0.09, "H3": 0.09, "H4": 0.025, "H5": 0.20}
    )
    assert [h for h, r in result.items() if r.rejected] == ["H1", "H4"]
    assert list(result) == ["H1", "H2", "H3", "H4", "H5"]


def test_holm_caps_adjusted_values_at_one() -> None:
    result = holm({"a": 0.6, "b": 0.7, "c": 0.9})
    assert [r.adjusted for r in result.values()] == [1.0, 1.0, 1.0]


def test_holm_rejects_strictly_below_alpha() -> None:
    result = holm({"a": 0.6, "b": 0.025}, alpha=0.05)
    assert result["b"].adjusted == pytest.approx(0.05)
    assert result["b"].rejected is False


# Wilson (Newcombe 1998, Statistics in Medicine 17:857-872, Table I, method 3).


@pytest.mark.parametrize(
    ("successes", "n", "low", "high"),
    [
        (81, 263, 0.2553, 0.3662),
        (15, 148, 0.0624, 0.1605),
        (0, 20, 0.0000, 0.1611),
        (1, 29, 0.0061, 0.1718),
    ],
)
def test_wilson_matches_newcombes_published_intervals(
    successes: int, n: int, low: float, high: float
) -> None:
    got = wilson(successes, n)
    assert got == pytest.approx((low, high), abs=5e-5)


def test_wilson_stays_inside_zero_and_one() -> None:
    low = wilson(0, 5)[0]
    high = wilson(5, 5)[1]
    assert 0.0 <= low == pytest.approx(0.0, abs=1e-15)
    assert 1.0 >= high == pytest.approx(1.0, abs=1e-15)


# H4's two one-sided tests.


def test_tost_finds_equivalence_when_the_difference_is_well_inside_the_margin() -> None:
    diffs = planted_differences(31, items=800, rate_a=0.10, rate_b=0.10)
    result = tost(diffs, margin=0.05, seed=32)
    assert result.equivalent
    assert result.p == max(result.p_lower, result.p_upper) < 0.05


def test_tost_refuses_equivalence_when_the_difference_exceeds_the_margin() -> None:
    diffs = planted_differences(33, items=800, rate_a=0.20, rate_b=0.10)
    result = tost(diffs, margin=0.05, seed=34)
    assert not result.equivalent
    assert result.p_upper > 0.5


def test_tost_marks_a_sample_with_no_discordant_item_as_degenerate() -> None:
    result = tost(np.zeros(12), margin=0.02, seed=1)
    assert result.degenerate
    assert result.equivalent


# The H1 table (research/analysis/h1.py) from a results file.


def write_sessions(path: Path, rows: list[dict[str, object]]) -> None:
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


def h1_rows(
    seed: int, items: int, rates: dict[str, float], benchmark: str
) -> list[dict[str, object]]:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, object]] = []
    for condition, rate in rates.items():
        draws = rng.random((items, 3)) < rate
        for i in range(items):
            for s in range(3):
                rows.append(
                    {
                        "benchmark": benchmark,
                        "model": "provider/m1",
                        "store": "fake",
                        "preset": "none" if condition == "C2" else "medium",
                        "condition": condition,
                        "item": f"{benchmark}/item-{i:03d}",
                        "seed": s + 1,
                        "violation": bool(draws[i, s]),
                    }
                )
    return rows


RATES = {"C2": 0.40, "C3": 0.30, "C4": 0.25, "C5": 0.05}


def h1_config(**overrides: object) -> H1Config:
    base: dict[str, object] = {"primary_model": "provider/m1", "store": "fake", "seed": 20261102}
    base.update(overrides)
    return H1Config(**base)  # type: ignore[arg-type]


def test_the_h1_table_recovers_a_planted_effect_and_decides_with_the_holm_bound(
    tmp_path: Path,
) -> None:
    path = tmp_path / "h1-sessions.jsonl"
    write_sessions(path, h1_rows(1, 250, RATES, "gatemem") + h1_rows(2, 60, RATES, "mem-inv-bench"))
    table = build_h1_table(read_sessions(path), h1_config())
    rates = {(r["benchmark"], r["condition"]): r for r in table["rates"]}
    c5 = rates[("gatemem", "C5")]
    assert c5["items"] == 250 and c5["sessions"] == 750 and c5["excluded"] == 0
    assert c5["wilson_low"] < 0.05 < c5["wilson_high"]
    # Wilson's n is the item count: the item is the unit of analysis.
    assert (c5["wilson_low"], c5["wilson_high"]) == pytest.approx(
        wilson(c5["rate"] * 250, 250), abs=1e-6
    )
    assert set(c5["seed_rates"]) == {"1", "2", "3"}
    primary = table["primary"]
    assert primary["contrast"] == "C4-C5" and primary["benchmark"] == "gatemem"
    assert primary["low"] <= 0.20 <= primary["high"]
    assert primary["p_one_sided"] < 0.01
    # Only H1's p-value exists, so Holm is bounded by 5p whatever H2 to H5 give.
    assert table["holm"]["method"] == "bound"
    assert table["holm"]["adjusted"] == pytest.approx(min(1.0, 5 * primary["p_one_sided"]))
    assert table["decision"]["h1"] == "supported"
    assert table["decision"]["secondary"] == "does not contradict"


def test_the_h1_table_applies_holm_when_all_five_primary_p_values_exist(tmp_path: Path) -> None:
    path = tmp_path / "h1-sessions.jsonl"
    write_sessions(path, h1_rows(3, 250, RATES, "gatemem"))
    others = {"H2": 0.03, "H3": 0.5, "H4": 0.2, "H5": 0.04}
    table = build_h1_table(read_sessions(path), h1_config(other_primary_p=others))
    assert table["holm"]["method"] == "holm"
    assert table["decision"]["secondary"] == "absent"
    assert table["decision"]["h1"] == "supported"


def test_the_h1_table_is_not_supported_when_enforcement_is_planted_worse(tmp_path: Path) -> None:
    path = tmp_path / "h1-sessions.jsonl"
    reverse = {"C2": 0.3, "C3": 0.2, "C4": 0.1, "C5": 0.2}
    write_sessions(path, h1_rows(4, 250, reverse, "gatemem"))
    table = build_h1_table(read_sessions(path), h1_config())
    assert table["primary"]["p_one_sided"] > 0.5
    assert table["decision"]["h1"] == "not supported"


@pytest.mark.parametrize(
    ("p", "others", "secondary_high", "h1", "method"),
    [
        (0.004, None, None, "supported", "bound"),
        (0.02, None, None, "undecided", "bound"),
        (0.2, None, None, "not supported", "bound"),
        (0.004, None, -0.01, "not supported", "bound"),
        (0.004, None, 0.0, "supported", "bound"),
        # Smallest of the five, so H1's p is multiplied by five: 0.10.
        (0.02, {"H2": 0.5, "H3": 0.6, "H4": 0.7, "H5": 0.8}, None, "not supported", "holm"),
        (0.02, {"H2": 0.001, "H3": 0.002, "H4": 0.003, "H5": 0.004}, None, "supported", "holm"),
        (0.03, {"H2": 0.001, "H3": 0.002, "H4": 0.003, "H5": 0.004}, 0.1, "supported", "holm"),
        (0.03, {"H2": 0.5, "H3": 0.6, "H4": 0.7, "H5": 0.011}, 0.1, "not supported", "holm"),
    ],
)
def test_the_h1_decision_by_hand(
    p: float,
    others: dict[str, float] | None,
    secondary_high: float | None,
    h1: str,
    method: str,
) -> None:
    decision, holm_part = decide_h1(p, others, secondary_high)
    assert decision["h1"] == h1
    assert holm_part["method"] == method


def test_the_results_schema_refuses_an_unknown_field_and_a_repeated_session(
    tmp_path: Path,
) -> None:
    good = h1_rows(5, 2, {"C4": 0.5}, "gatemem")
    path = tmp_path / "x.jsonl"
    write_sessions(path, [*good, {**good[0], "extra": 1}])
    with pytest.raises(SchemaError, match="extra"):
        read_sessions(path)
    write_sessions(path, [*good, good[0]])
    with pytest.raises(SchemaError, match="repeated"):
        read_sessions(path)
    write_sessions(path, [{**good[0], "condition": "C9"}])
    with pytest.raises(SchemaError, match="condition"):
        read_sessions(path)


def test_an_excluded_session_is_counted_and_left_out(tmp_path: Path) -> None:
    rows = h1_rows(6, 30, {"C4": 0.5, "C5": 0.1}, "gatemem")
    rows[0] = {**rows[0], "violation": None}
    path = tmp_path / "x.jsonl"
    write_sessions(path, rows)
    table = build_h1_table(read_sessions(path), h1_config())
    c4 = next(r for r in table["rates"] if r["condition"] == "C4")
    assert c4["excluded"] == 1 and c4["sessions"] == 89
