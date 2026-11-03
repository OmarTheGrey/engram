"""H4's equivalence test: two one-sided score tests with a variance floor.

H4 (docs/research/preregistration.md) says the violation rate under C5 does
not depend on the store or the model. Each pair of arms is tested on its
item-level differences d in [-1, 1] (seed-averaged 0/1 outcomes, paired on
item and seed) for |mean| < margin, by two one-sided tests (TOST).

H4's table code pairs through `complete_item_differences`, not through
`analysis.bootstrap.paired_item_differences`: the latter keeps an item that
lost a seed under either arm, averaged over the seeds left, but an item
averaged over two seeds lies off the three-seed lattice H4's level was
searched on, so decision sheet 13h takes it out of that pair's test.
`complete_item_differences` keeps only items both arms kept on every seed
and returns the rest, which H4's table reports as a count.

The lower side tests H0: mean <= -margin against mean > -margin with

    z_lower = (mean + margin) / sqrt(v_lower / n),
    v_lower = max(mean of (d + margin)^2, margin (1 - margin)),

and the upper side the same with the signs turned. Two choices make it hold
its level where a bootstrap did not (review findings P2-1 of the first round
and V1 of the second):

- The variance is the second moment about the null's boundary, as in a score
  test, not about the sample mean: under H0 it estimates the variance at the
  boundary, and a sample far inside the margin is not credited with a spread
  it owes to its distance from it.
- It never falls below margin (1 - margin), the variance of a difference that
  is -1 on a margin's share of items and 0 on the rest: the sparsest way two
  arms can differ by the margin when seeds repeat their outcome. Without the
  floor a sample in which few or no items disagree has an estimated variance
  near zero and passes whatever the truth.

Each side is held to alpha / 2, and the TOST's p-value is
min(1, 2 max(p_lower, p_upper)): equivalence at level alpha exactly when
p < alpha, so p is on the scale of the other primary p-values (finding V3).
The normal approximation of each side runs above its nominal level when the
differences are skewed (one arm's violations rare where the other's are
not), and halving alpha does not always absorb it: over the composite null
the level exceeds alpha at small sizes (review round 3, R2-1).
research/analysis/power.py searches the composite null's boundary, the
distributions of an item's difference on the three-seed lattice whose mean
is on the margin (|mean| = margin), and computes each level it visits
exactly; the largest level that search found is a lower bound on the
supremum. The interior of the null (|mean| beyond the margin) is not
searched, and no argument is made that it holds a lower level; items are
assumed independent and identically distributed. H4's sizes are only those
at which the largest level found is at most alpha (and, since Holm may test
H4 at 0.05 / k for k = 1 to 5, research/results/h4-holm-levels.json records
it at every such threshold for the sizes committed at alpha 0.01). The level
is checked, not proved.

H4 names three arms in each of several families (stores and models, on each
benchmark) and holds only if every pair in every family is equivalent. Its
one primary p-value, the one Holm adjusts with the other four, is the
intersection-union p (`intersection_union_p`): the largest pairwise TOST p.
H4's null is the union of the pairs' nulls; wherever it holds, some pair's
null holds, and the largest p falls below alpha only if that pair's does,
which has probability at most alpha. So the largest p is a valid p-value for
H4, H4 is supported at alpha exactly when every pair is, and no correction
for the number of pairs is needed.

Monotone in the evidence: the decision depends on the sample only through
(sum d, sum d^2); at a fixed mean, a less dispersed sample has a smaller sum
of squares, hence smaller variances, larger z and a smaller p. No randomness,
so no seed.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from statistics import NormalDist

import numpy as np
import numpy.typing as npt

from analysis.bootstrap import ALPHA, FloatArray, Session, _values

_NORMAL = NormalDist()
BoolArray = npt.NDArray[np.bool_]


def complete_item_differences(
    a: Iterable[Session], b: Iterable[Session], seeds: Sequence[int]
) -> tuple[list[str], FloatArray, list[str]]:
    """H4's paired differences a minus b, over items both arms kept on every seed.

    An item excluded or missing on any of `seeds` under either arm leaves the
    pair's test (decision sheet 13h; see the module docstring). Returns the
    items kept, sorted, their differences (each the mean over `seeds`), and
    the items dropped, sorted. A repeated (item, seed) under one arm is an
    error.
    """

    def outcomes(sessions: Iterable[Session]) -> dict[tuple[str, int], float | None]:
        out: dict[tuple[str, int], float | None] = {}
        for item, seed, outcome in sessions:
            if (item, seed) in out:
                raise ValueError(f"item {item!r} seed {seed} appears twice")
            out[(item, seed)] = outcome
        return out

    first, second = outcomes(a), outcomes(b)
    every = sorted({item for item, _ in first} | {item for item, _ in second})
    kept: list[str] = []
    diffs: list[float] = []
    dropped: list[str] = []
    for item in every:
        pairs = [(first.get((item, s)), second.get((item, s))) for s in seeds]
        if all(x is not None and y is not None for x, y in pairs):
            kept.append(item)
            diffs.append(
                sum(float(x) - float(y) for x, y in pairs if x is not None and y is not None)
                / len(seeds)
            )
        else:
            dropped.append(item)
    return kept, np.array(diffs, dtype=np.float64), dropped


def critical_z(alpha: float) -> float:
    """The one-sided critical value at alpha / 2."""
    return _NORMAL.inv_cdf(1.0 - alpha / 2.0)


def variance_floor(margin: float) -> float:
    """margin (1 - margin): the null variance of the sparsest disagreement at the margin."""
    return margin * (1.0 - margin)


def score_z(
    total: FloatArray, squares: FloatArray, n: int, margin: float
) -> tuple[FloatArray, FloatArray]:
    """z_lower and z_upper from the sums of d and of d^2 over n items (vectorised)."""
    mean = total / n
    second = squares / n
    floor = variance_floor(margin)
    v_lower = np.maximum(second + 2.0 * margin * mean + margin**2, floor)
    v_upper = np.maximum(second - 2.0 * margin * mean + margin**2, floor)
    z_lower: FloatArray = (mean + margin) / np.sqrt(v_lower / n)
    z_upper: FloatArray = (margin - mean) / np.sqrt(v_upper / n)
    return z_lower, z_upper


def equivalent_from_sums(
    total: FloatArray, squares: FloatArray, n: int, margin: float, alpha: float = ALPHA
) -> BoolArray:
    """The TOST's decision for many samples at once, from their sums (p < alpha)."""
    z_lower, z_upper = score_z(total, squares, n, margin)
    decided: BoolArray = np.minimum(z_lower, z_upper) > critical_z(alpha)
    return decided


@dataclass(frozen=True)
class EquivalenceResult:
    """Two one-sided score tests of |mean difference| < margin (see the module docstring)."""

    n: int
    mean: float
    margin: float
    z_lower: float
    z_upper: float
    p_lower: float
    """1 - Phi(z_lower): against H0, the difference is at most -margin."""
    p_upper: float
    """1 - Phi(z_upper): against H0, the difference is at least the margin."""
    p: float
    """min(1, 2 max(p_lower, p_upper)); equivalence at level alpha exactly when p < alpha."""
    alpha: float
    equivalent: bool
    variance_floor: float


def intersection_union_p(results: Iterable[EquivalenceResult]) -> float:
    """H4's one primary p-value: the largest TOST p over every pair of every family it names.

    Below alpha exactly when every pair is equivalent at alpha (see the
    module docstring for why it is a valid p-value for H4).
    """
    values = [r.p for r in results]
    if not values:
        raise ValueError("H4's p-value needs at least one pair")
    return max(values)


def tost(
    differences: Sequence[float] | FloatArray, *, margin: float, alpha: float = ALPHA
) -> EquivalenceResult:
    """Equivalence within `margin` at level `alpha` (see the module docstring)."""
    if not 0.0 < margin < 1.0:
        raise ValueError("the equivalence margin must lie in (0, 1)")
    d = _values(differences)
    n = int(d.size)
    z_lower, z_upper = (
        float(z[0]) for z in score_z(np.array([d.sum()]), np.array([(d * d).sum()]), n, margin)
    )
    p_lower = 1.0 - _NORMAL.cdf(z_lower)
    p_upper = 1.0 - _NORMAL.cdf(z_upper)
    p = min(1.0, 2.0 * max(p_lower, p_upper))
    return EquivalenceResult(
        n=n,
        mean=float(d.mean()),
        margin=margin,
        z_lower=z_lower,
        z_upper=z_upper,
        p_lower=p_lower,
        p_upper=p_upper,
        p=p,
        alpha=alpha,
        equivalent=min(z_lower, z_upper) > critical_z(alpha),
        variance_floor=variance_floor(margin),
    )
