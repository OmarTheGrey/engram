"""The paired bootstrap of a mean difference, its BCa interval and one-sided p-value, and TOST.

The Statistics section of docs/research/preregistration.md (v0.2), executable
(plan decision 3 of docs/tasks/prereg-v1-plan.md; ADR 0016):

- The unit is the benchmark item, paired across conditions on the same item,
  model and seed. Seeds are averaged within an item before resampling, over
  the seeds both conditions kept (`paired_item_differences`; `item_means`
  gives one condition's rate).
- The interval is a paired bootstrap of the mean difference: 10,000
  resamples, BCa, 95 percent (Efron and Tibshirani 1993, ch. 14; the formulas
  in docs/readings/litreview/methods-efron-tibshirani-bootstrap.md). The
  percentile interval is reported beside it, with z0 and the acceleration, so
  a reader sees when BCa moved the endpoints.
- The one-sided p-value is the share of resamples at or below zero.
- H4's equivalence test is not a bootstrap: see `analysis.equivalence`.

How a resample is drawn. The bootstrap draws n items with replacement; the
mean of a resample depends only on how often each item is drawn, which is
Multinomial(n, 1/n, ..., 1/n), and items with equal differences can be pooled
into one category. So `resample_means` draws the counts of the distinct
differences from one multinomial, which is the same distribution as drawing
indices and costs time in the number of distinct values (at most seven for
binary outcomes averaged over three seeds) instead of the number of items.

Ties. The bootstrap distribution of a mean of 0/1 outcomes is discrete: many
resamples have a mean exactly equal to zero, to a margin, or to the observed
mean in exact arithmetic, but floating-point sums in a different order land a
few units in the last place to either side (on a 30-item sample of thirds,
scipy's exact comparison found 189 of 611 resamples tying the observed mean).
So every comparison of a resample mean with a bound (`at_or_below`,
`at_or_above`, the ties of z0) treats values within TOLERANCE as equal: far
above rounding error, far below the smallest step between distinct means
(1 / (3 n) for three seeds). z0 counts ties at the observed mean as half
below, as scipy's reference implementation means to (scipy.stats.bootstrap,
`_percentile_of_score`, which compares exactly); Efron and Tibshirani's strict
count would push z0 down whenever resamples tie the observed mean.

Every function that resamples takes `seed` and has no default (AGENTS.md rule 6).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from statistics import NormalDist
from typing import Literal

import numpy as np
import numpy.typing as npt

RESAMPLES = 10_000
CONFIDENCE = 0.95
ALPHA = 0.05

TOLERANCE = 1e-9
"""Resample means closer than this to a bound are at the bound (see the module docstring)."""

FloatArray = npt.NDArray[np.float64]
_NORMAL = NormalDist()

Session = tuple[str, int, float | None]
"""(item, seed, outcome); an outcome of None is an excluded session."""


def item_means(sessions: Iterable[Session]) -> dict[str, float]:
    """The mean outcome over the seeds of each item; excluded sessions count for nothing.

    An item whose every session is excluded is absent. A repeated (item, seed)
    is an error: it would weight one sample twice.
    """
    seen: set[tuple[str, int]] = set()
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for item, seed, outcome in sessions:
        if (item, seed) in seen:
            raise ValueError(f"item {item!r} seed {seed} appears twice")
        seen.add((item, seed))
        if outcome is None:
            continue
        sums[item] = sums.get(item, 0.0) + float(outcome)
        counts[item] = counts.get(item, 0) + 1
    return {item: sums[item] / counts[item] for item in sorted(sums)}


def paired_differences(
    a: Mapping[str, float], b: Mapping[str, float]
) -> tuple[list[str], FloatArray]:
    """The items under both conditions, sorted, and their differences a minus b."""
    items = sorted(set(a) & set(b))
    return items, np.array([a[i] - b[i] for i in items], dtype=np.float64)


def paired_item_differences(
    a: Iterable[Session], b: Iterable[Session]
) -> tuple[list[str], FloatArray]:
    """Item-level differences a minus b, over the seeds both conditions kept.

    The pairing is on the same item, model and seed (the pre-registration's
    unit): an (item, seed) excluded or missing under either condition is
    dropped from both, then each item's difference is averaged over its
    remaining seeds. An item with no seed left is left out; a repeated
    (item, seed) under one condition is an error.
    """

    def outcomes(sessions: Iterable[Session]) -> dict[tuple[str, int], float | None]:
        out: dict[tuple[str, int], float | None] = {}
        for item, seed, outcome in sessions:
            if (item, seed) in out:
                raise ValueError(f"item {item!r} seed {seed} appears twice")
            out[(item, seed)] = outcome
        return out

    first, second = outcomes(a), outcomes(b)
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for key in first.keys() & second.keys():
        x, y = first[key], second[key]
        if x is None or y is None:
            continue
        sums[key[0]] = sums.get(key[0], 0.0) + float(x) - float(y)
        counts[key[0]] = counts.get(key[0], 0) + 1
    items = sorted(sums)
    return items, np.array([sums[i] / counts[i] for i in items], dtype=np.float64)


def _values(values: Sequence[float] | FloatArray) -> FloatArray:
    out = np.asarray(values, dtype=np.float64)
    if out.ndim != 1 or out.size == 0:
        raise ValueError("differences must be a non-empty one-dimensional sequence")
    if not np.all(np.isfinite(out)):
        raise ValueError("differences must be finite")
    return out


def resample_means(values: FloatArray, *, resamples: int, rng: np.random.Generator) -> FloatArray:
    """The means of `resamples` bootstrap resamples of `values` (see the module docstring)."""
    distinct, counts = np.unique(values, return_counts=True)
    if distinct.size == 1:
        return np.full(resamples, float(distinct[0]))
    draws = rng.multinomial(values.size, counts / values.size, size=resamples)
    means: FloatArray = (draws @ distinct) / values.size
    return means


def at_or_below(theta_star: FloatArray, bound: float) -> float:
    """The share of resample means at or below `bound`, ties within TOLERANCE included."""
    return float(np.mean(theta_star <= bound + TOLERANCE))


def at_or_above(theta_star: FloatArray, bound: float) -> float:
    """The share of resample means at or above `bound`, ties within TOLERANCE included."""
    return float(np.mean(theta_star >= bound - TOLERANCE))


def _all_equal(values: FloatArray) -> bool:
    return float(np.ptp(values)) <= TOLERANCE


def acceleration(values: FloatArray) -> float:
    """The jackknife acceleration of the mean (Efron and Tibshirani 1993, eq. 14.15)."""
    n = values.size
    jack = (values.sum() - values) / (n - 1)
    u = jack.mean() - jack
    spread = float((u**2).sum())
    if spread == 0.0:
        return 0.0
    return float((u**3).sum() / (6.0 * spread**1.5))


def bca_interval(
    values: FloatArray, theta_star: FloatArray, *, confidence: float
) -> tuple[float, float, float, float]:
    """The BCa interval's endpoints, z0 and the acceleration, for the mean of `values`.

    `theta_star` is the bootstrap distribution of the mean. Raises ValueError
    when every resample lies on one side of the observed mean, where z0 is
    infinite and BCa is undefined.
    """
    theta = float(values.mean())
    below = int(np.count_nonzero(theta_star < theta - TOLERANCE))
    ties = int(np.count_nonzero(np.abs(theta_star - theta) <= TOLERANCE))
    share = (2 * below + ties) / (2 * theta_star.size)
    if share <= 0.0 or share >= 1.0:
        raise ValueError("every resample lies on one side of the observed mean; BCa is undefined")
    z0 = _NORMAL.inv_cdf(share)
    a = acceleration(values)
    z_low = _NORMAL.inv_cdf((1.0 - confidence) / 2.0)
    ends = []
    for z in (z_low, -z_low):
        ends.append(_NORMAL.cdf(z0 + (z0 + z) / (1.0 - a * (z0 + z))))
    low, high = np.quantile(theta_star, ends)
    return float(low), float(high), z0, a


@dataclass(frozen=True)
class BootstrapResult:
    """A paired bootstrap of the mean difference.

    `low` and `high` are the interval `method` names.
    """

    n: int
    mean: float
    low: float
    high: float
    method: Literal["BCa", "percentile", "degenerate"]
    percentile_low: float
    percentile_high: float
    p_one_sided: float
    z0: float | None
    acceleration: float | None
    resamples: int
    confidence: float


def paired_bootstrap(
    differences: Sequence[float] | FloatArray,
    *,
    seed: int,
    resamples: int = RESAMPLES,
    confidence: float = CONFIDENCE,
) -> BootstrapResult:
    """The paired bootstrap of the mean of item-level differences.

    The one-sided p-value is the share of resamples at or below zero, the
    evidence that the mean difference is positive. When every difference is
    the same the bootstrap distribution is a point: the result says so
    (`method` "degenerate") instead of returning a NaN interval. When every
    resample lies on one side of the observed mean BCa is undefined and the
    percentile interval is returned (`method` "percentile").
    """
    d = _values(differences)
    mean = float(d.mean())
    if _all_equal(d):
        return BootstrapResult(
            n=int(d.size),
            mean=mean,
            low=mean,
            high=mean,
            method="degenerate",
            percentile_low=mean,
            percentile_high=mean,
            p_one_sided=1.0 if mean <= 0.0 else 0.0,
            z0=None,
            acceleration=None,
            resamples=resamples,
            confidence=confidence,
        )
    star = resample_means(d, resamples=resamples, rng=np.random.default_rng(seed))
    tail = (1.0 - confidence) / 2.0
    p_low, p_high = (float(x) for x in np.quantile(star, [tail, 1.0 - tail]))
    p_value = at_or_below(star, 0.0)
    try:
        low, high, z0, a = bca_interval(d, star, confidence=confidence)
    except ValueError:
        return BootstrapResult(
            n=int(d.size),
            mean=mean,
            low=p_low,
            high=p_high,
            method="percentile",
            percentile_low=p_low,
            percentile_high=p_high,
            p_one_sided=p_value,
            z0=None,
            acceleration=acceleration(d),
            resamples=resamples,
            confidence=confidence,
        )
    return BootstrapResult(
        n=int(d.size),
        mean=mean,
        low=low,
        high=high,
        method="BCa",
        percentile_low=p_low,
        percentile_high=p_high,
        p_one_sided=p_value,
        z0=z0,
        acceleration=a,
        resamples=resamples,
        confidence=confidence,
    )
