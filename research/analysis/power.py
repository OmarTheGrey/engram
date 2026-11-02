"""H4's sample size by seeded simulation with the analysis code's own TOST (plan decision 2).

H4 says the violation rate under C5 does not depend on the store or the model:
every pairwise equivalence across the three stores (and across the three
models) holds within a margin, by the TOST of `analysis.equivalence`. v0.1
sized it from a pilot, which needs a model key; this module replaces the
pilot with a simulation under stated assumptions.

The generative model. Per item and seed, every arm (a store or a model)
reads one uniform draw and violates when it falls below the arm's rate; with
probability 1 - kappa the arms read the same draw, otherwise each reads its
own. With equal rates p (the equivalence alternative, where a test should
pass) every arm's rate is p and two arms disagree with probability
kappa * 2p(1 - p): kappa is the discordance relative to independent arms
(kappa 1 is no pairing benefit at all; kappa 0.25 means the arm changes the
outcome in a quarter of the sessions, as a store might under one model). With
rates p and p + margin (the null at the margin, where a test must not pass)
the shared draws make the arms disagree on a margin's share of them in one
direction; kappa 0 is the sparsest disagreement the margin allows. Seeds are
`independent` (each seed a fresh sample, the pre-registered design) or
`identical` (the model gives an item the same outcome on every seed, so three
seeds carry the information of one). Seeds are averaged within an item, and
each pair of arms is tested on the item-level differences.

H4 holds for a family of arms only if every pair is equivalent, so the power
reported is the share of simulated studies in which all pairs pass (an
intersection-union test, which needs no multiplicity correction). The TOST's
level is checked at every size reported: `exact_level` computes it exactly at
kappa 0 (the disagreement count is binomial there), and `simulated_level`
measures it at other kappas; `level_gate` admits a size only if the exact
levels are at most alpha and the measured ones are at most alpha by two
Monte Carlo standard errors.

The TOST decides from the sums of d and d^2 (`equivalent_from_sums`), so whole
batches of simulated studies are tested at once.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from statistics import NormalDist
from typing import Literal

import numpy as np

from analysis.bootstrap import ALPHA, FloatArray
from analysis.equivalence import critical_z, equivalent_from_sums, variance_floor

SeedModel = Literal["independent", "identical"]
SEED_MODELS: tuple[SeedModel, ...] = ("identical", "independent")
CHUNK = 4_000_000
"""Uniform draws per batch of simulated studies."""


@dataclass(frozen=True)
class Cell:
    """One point of the grid: the true rate, the margin and the pairing assumptions."""

    rate: float
    margin: float
    kappa: float
    seed_model: SeedModel
    arms: int = 3
    seeds: int = 3


def _draws(seed_model: SeedModel, seeds: int) -> int:
    return seeds if seed_model == "independent" else 1


def simulate_arms(
    rates: Sequence[float],
    kappa: float,
    seed_model: SeedModel,
    seeds: int,
    items: int,
    rng: np.random.Generator,
) -> FloatArray:
    """Seed-averaged outcomes, shape (arms, items), one arm per rate (see the module docstring)."""
    batch = simulate_batch(rates, kappa, seed_model, seeds, items, 1, rng)
    first: FloatArray = batch[0]
    return first


def simulate_items(cell: Cell, items: int, rng: np.random.Generator) -> FloatArray:
    """The cell's arms at its common rate, shape (arms, items)."""
    return simulate_arms(
        [cell.rate] * cell.arms, cell.kappa, cell.seed_model, cell.seeds, items, rng
    )


def simulate_batch(
    rates: Sequence[float],
    kappa: float,
    seed_model: SeedModel,
    seeds: int,
    items: int,
    studies: int,
    rng: np.random.Generator,
) -> FloatArray:
    """Seed-averaged outcomes of `studies` independent studies, shape (studies, arms, items)."""
    draws = _draws(seed_model, seeds)
    shared = rng.random((studies, 1, items, draws))
    split = rng.random((studies, 1, items, draws)) < kappa
    own = rng.random((studies, len(rates), items, draws))
    uniform = np.where(split, own, shared)
    outcomes = uniform < np.asarray(rates, dtype=np.float64)[None, :, None, None]
    means: FloatArray = outcomes.mean(axis=3, dtype=np.float64)
    return means


def _batches(total: int, per_study: int) -> list[int]:
    size = max(1, CHUNK // max(1, per_study))
    return [min(size, total - start) for start in range(0, total, size)]


@dataclass(frozen=True)
class PowerPoint:
    items: int
    power: float
    pair_power: float
    simulations: int


def power_at(
    cell: Cell,
    items: int,
    *,
    simulations: int,
    seed: int,
    alpha: float = ALPHA,
) -> PowerPoint:
    """The share of `simulations` seeded studies whose every pair passes, at `items` per arm."""
    rng = np.random.default_rng(np.random.SeedSequence([seed, items, simulations]))
    rates = [cell.rate] * cell.arms
    per_study = cell.arms * items * _draws(cell.seed_model, cell.seeds)
    joint = first = 0
    for batch in _batches(simulations, per_study):
        means = simulate_batch(rates, cell.kappa, cell.seed_model, cell.seeds, items, batch, rng)
        passed = []
        for a, b in combinations(range(cell.arms), 2):
            d = means[:, a, :] - means[:, b, :]
            passed.append(
                equivalent_from_sums(d.sum(axis=1), (d * d).sum(axis=1), items, cell.margin, alpha)
            )
        joint += int(np.logical_and.reduce(passed).sum())
        first += int(passed[0].sum())
    return PowerPoint(
        items=items,
        power=joint / simulations,
        pair_power=first / simulations,
        simulations=simulations,
    )


def simulated_level(
    rate: float,
    margin: float,
    items: int,
    kappa: float,
    seed_model: SeedModel,
    *,
    runs: int,
    seed: int,
    alpha: float = ALPHA,
    seeds: int = 3,
) -> float:
    """How often one pair is declared equivalent when its true difference is on the margin.

    The pair's rates are (rate, rate + margin) and the reverse, `runs` times
    each, under `kappa` and `seed_model`; the larger of the two shares.
    """
    per_study = 2 * items * _draws(seed_model, seeds)
    worst = 0.0
    for direction, rates in enumerate(((rate, rate + margin), (rate + margin, rate))):
        rng = np.random.default_rng(
            np.random.SeedSequence(
                [seed, items, direction, round(kappa * 1_000_000), SEED_MODELS.index(seed_model)]
            )
        )
        passed = 0
        for batch in _batches(runs, per_study):
            means = simulate_batch(rates, kappa, seed_model, seeds, items, batch, rng)
            d = means[:, 0, :] - means[:, 1, :]
            passed += int(
                equivalent_from_sums(d.sum(axis=1), (d * d).sum(axis=1), items, margin, alpha).sum()
            )
        worst = max(worst, passed / runs)
    return worst


@lru_cache(maxsize=8)
def _log_factorials(n: int) -> FloatArray:
    values: FloatArray = np.array([math.lgamma(i + 1) for i in range(n + 1)], dtype=np.float64)
    return values


def _window(mean: float, n: int) -> int:
    """A count past which a binomial cell's tail is negligible; the mass left out is added back."""
    return min(n, int(mean + 10.0 * math.sqrt(mean + 1.0) + 12.0))


def exact_level(
    margin: float,
    items: int,
    seed_model: SeedModel,
    *,
    alpha: float = ALPHA,
    seeds: int = 3,
) -> float:
    """The TOST's level at kappa 0 with one arm a margin above the other: exact, rounded up.

    At kappa 0 every session of the higher arm violates where the lower one
    does and on a margin's share more, so each seed disagrees independently
    with probability `margin`, always the same way. With identical seeds an
    item differs by -1 with probability `margin`; with independent seeds by
    -j / 3, j binomial over three seeds. The TOST decides from (sum d,
    sum d^2), so the level is a sum over the counts' multinomial distribution.
    The sum runs over the counts that carry the probability; the mass left
    out (well below 1e-12) is added to the result, so the value returned is
    never below the true level. The other direction is the mirror image and
    has the same level, and the lower arm's own rate does not enter.
    """
    log_f = _log_factorials(items)
    if seed_model == "identical":
        k = np.arange(0, _window(items * margin, items) + 1)
        log_p = (
            log_f[items]
            - log_f[k]
            - log_f[items - k]
            + k * math.log(margin)
            + (items - k) * math.log1p(-margin)
        )
        decided = equivalent_from_sums(
            -k.astype(np.float64), k.astype(np.float64), items, margin, alpha
        )
        mass = np.exp(log_p)
        return float(np.sum(mass * decided) + max(0.0, 1.0 - float(np.sum(mass))))
    if seeds != 3:
        raise ValueError("the exact level with independent seeds is computed for three seeds")
    q = [
        (1 - margin) ** 3,
        3 * margin * (1 - margin) ** 2,
        3 * margin**2 * (1 - margin),
        margin**3,
    ]
    log_q = [math.log(x) for x in q]
    n1, n2 = np.meshgrid(
        np.arange(0, _window(items * q[1], items) + 1),
        np.arange(0, _window(items * q[2], items) + 1),
        indexing="ij",
    )
    level = 0.0
    covered = 0.0
    for n3 in range(_window(items * q[3], items) + 1):
        n0 = items - n1 - n2 - n3
        ok = n0 >= 0
        if not ok.any():
            break
        a0, a1, a2 = n0[ok], n1[ok], n2[ok]
        log_p = (
            log_f[items]
            - log_f[a0]
            - log_f[a1]
            - log_f[a2]
            - log_f[n3]
            + a0 * log_q[0]
            + a1 * log_q[1]
            + a2 * log_q[2]
            + n3 * log_q[3]
        )
        mass = np.exp(log_p)
        sums = -(a1 + 2 * a2 + 3 * n3) / 3.0
        squares = (a1 + 4 * a2 + 9 * n3) / 9.0
        decided = equivalent_from_sums(sums, squares, items, margin, alpha)
        level += float(np.sum(mass * decided))
        covered += float(np.sum(mass))
    return level + max(0.0, 1.0 - covered)


def level_gate(
    exact: Sequence[float], simulated: Sequence[float], *, alpha: float, runs: int
) -> bool:
    """Exact levels at most alpha; measured ones at most alpha by two Monte Carlo errors."""
    tolerance = 2.0 * math.sqrt(alpha * (1.0 - alpha) / runs)
    return all(e <= alpha for e in exact) and all(m + tolerance <= alpha for m in simulated)


def joint_threshold(target: float, *, draws: int = 400_000, seed: int = 20261102) -> float:
    """The t with P(|X1| < t, |X2| < t, |X1 - X2| < t) = target (standard, correlation 0.5).

    Three exchangeable arms' pairwise differences, each standardised: the
    normal approximation's chance that all three pairs land inside the margin
    by more than the one-sided critical value. Seeded Monte Carlo, then bisection.
    """
    rng = np.random.default_rng(seed)
    z = rng.standard_normal((draws, 2))
    x1 = z[:, 0]
    x2 = 0.5 * z[:, 0] + np.sqrt(0.75) * z[:, 1]
    spread = np.maximum(np.maximum(np.abs(x1), np.abs(x2)), np.abs(x1 - x2))
    return float(np.quantile(spread, target))


def normal_approx_items(
    cell: Cell, *, alpha: float = ALPHA, power: float = 0.8, joint: bool = False
) -> float:
    """Items for `power` by the normal approximation, true difference zero.

    The item-level difference has variance kappa * 2p(1 - p) divided by the
    number of independent seeds; the TOST's variance about the margin adds the
    margin squared and is floored at margin (1 - margin) (`analysis.equivalence`).
    Each side is held to alpha / 2, so one pair needs margin / se of at least
    z(1 - alpha / 2) + z(1 - (1 - power) / 2); all three pairs need the first
    plus `joint_threshold`.
    """
    z = NormalDist().inv_cdf
    draws = _draws(cell.seed_model, cell.seeds)
    variance = cell.kappa * 2 * cell.rate * (1 - cell.rate) / draws
    score = max(variance + cell.margin**2, variance_floor(cell.margin))
    spread = joint_threshold(power) if joint else z(1 - (1 - power) / 2)
    return score * (critical_z(alpha) + spread) ** 2 / cell.margin**2


def ladder(start: int, stop: int, steps_per_doubling: int) -> list[int]:
    """Sample sizes from `start` to at most `stop`, geometric, `steps_per_doubling` per doubling."""
    out: list[int] = []
    k = 0
    while (n := round(start * 2 ** (k / steps_per_doubling))) <= stop:
        if not out or n > out[-1]:
            out.append(n)
        k += 1
    return out


def smallest_passing(
    rungs: list[int], start: int, power: Callable[[int], float], target: float
) -> int | None:
    """The smallest rung at or near `start` whose power reaches `target`, walking the ladder.

    Up from `start` until the power reaches the target; or, when it already
    does, down while the rung below still does. Walking down stops at the
    first rung below the target.
    """
    r = start
    if power(rungs[r]) >= target:
        while r > 0 and power(rungs[r - 1]) >= target:
            r -= 1
        return r
    while r + 1 < len(rungs):
        r += 1
        if power(rungs[r]) >= target:
            return r
    return None


def start_rung(rungs: list[int], items: float) -> int:
    """The largest rung at or below `items` (the first rung when none is)."""
    below = [i for i, n in enumerate(rungs) if n <= items]
    return below[-1] if below else 0


def choose_rung(
    rungs: int,
    start: int,
    power_holds: Callable[[int], bool],
    level_holds: Callable[[int], bool],
) -> int | None:
    """The smallest rung, from `start`, whose power reaches the target and whose level holds.

    Climbs while the power falls short; walks down while the rung below also
    reaches the target, but never below a rung whose level failed; climbs past
    a rung whose level fails. None when the ladder of `rungs` rungs runs out.
    """
    floor = 0
    r = start
    while 0 <= r < rungs:
        if not power_holds(r):
            r += 1
        elif r > floor and power_holds(r - 1):
            r -= 1
        elif not level_holds(r):
            floor = r + 1
            r += 1
        else:
            return r
    return None
