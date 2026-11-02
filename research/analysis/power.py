"""H4's sample size by seeded simulation with the analysis code's own TOST (plan decision 2).

H4 says the violation rate under C5 does not depend on the store or the model:
every pairwise equivalence across the three stores (and across the three
models) holds within a margin, by two one-sided tests (`analysis.bootstrap.tost`).
v0.1 sized it from a pilot, which needs a model key; this module replaces the
pilot with a simulation under stated assumptions.

The generative model, per item and seed, for `arms` arms (stores or models)
sharing the same true violation rate p (the equivalence alternative, where a
test should pass):

- with probability 1 - kappa the arms share one outcome, drawn Bernoulli(p);
- with probability kappa each arm draws its own, Bernoulli(p).

Every arm's marginal rate is p, and two arms disagree with probability
kappa * 2p(1 - p): kappa is the discordance relative to independent arms
(kappa 1 is no pairing benefit at all; kappa 0.25 means the arm changes the
outcome in a quarter of the sessions, as a store might under one model).
Seeds are `independent` (each seed a fresh sample, the pre-registered design)
or `identical` (the model gives an item the same outcome on every seed, so
three seeds carry the information of one). Seeds are averaged within an item,
and each pair of arms is tested on the item-level differences.

H4 holds only if every pair is equivalent, so the power reported is the share
of simulated studies in which all pairs pass (an intersection-union test,
which needs no multiplicity correction). A pair whose arms agree on every item
has no discordant item: its bootstrap is a point at zero and passes whatever
the margin. Such a study is counted twice, once as the test is written (it
passes) and once as not passing, and both sample sizes are reported.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from itertools import combinations
from statistics import NormalDist
from typing import Literal

import numpy as np

from analysis.bootstrap import ALPHA, RESAMPLES, FloatArray, tost

SeedModel = Literal["independent", "identical"]


@dataclass(frozen=True)
class Cell:
    """One point of the grid: the true rate, the margin and the pairing assumptions."""

    rate: float
    margin: float
    kappa: float
    seed_model: SeedModel
    arms: int = 3
    seeds: int = 3


def simulate_items(cell: Cell, items: int, rng: np.random.Generator) -> FloatArray:
    """Seed-averaged outcomes, shape (arms, items), under the cell's generative model."""
    draws = cell.seeds if cell.seed_model == "independent" else 1
    shared = rng.random((items, draws)) < cell.rate
    own = rng.random((cell.arms, items, draws)) < cell.rate
    split = rng.random((items, draws)) < cell.kappa
    outcomes = np.where(split[None, :, :], own, shared[None, :, :])
    means: FloatArray = outcomes.mean(axis=2, dtype=np.float64)
    return means


@dataclass(frozen=True)
class StudyOutcome:
    passed: bool
    """Every pair equivalent, as the test is written."""
    passed_nondegenerate: bool
    """Every pair equivalent and no pair without a discordant item."""
    first_pair_passed: bool


def study(
    cell: Cell, items: int, seed: int, *, resamples: int = RESAMPLES, alpha: float = ALPHA
) -> StudyOutcome:
    """One simulated H4 study at `items` items: every pairwise TOST on fresh data."""
    seq = np.random.SeedSequence(seed)
    data_seed, *pair_seeds = seq.generate_state(1 + cell.arms * (cell.arms - 1) // 2)
    values = simulate_items(cell, items, np.random.default_rng(int(data_seed)))
    results = [
        tost(
            values[a] - values[b],
            margin=cell.margin,
            seed=int(pair_seed),
            resamples=resamples,
            alpha=alpha,
        )
        for (a, b), pair_seed in zip(combinations(range(cell.arms), 2), pair_seeds, strict=True)
    ]
    passed = all(r.equivalent for r in results)
    return StudyOutcome(
        passed=passed,
        passed_nondegenerate=passed and not any(r.degenerate for r in results),
        first_pair_passed=results[0].equivalent,
    )


@dataclass(frozen=True)
class PowerPoint:
    items: int
    power: float
    power_nondegenerate: float
    pair_power: float
    simulations: int


def power_at(
    cell: Cell,
    items: int,
    *,
    simulations: int,
    seed: int,
    resamples: int = RESAMPLES,
    alpha: float = ALPHA,
) -> PowerPoint:
    """The share of `simulations` seeded studies that pass, at `items` items per arm."""
    seeds = np.random.SeedSequence([seed, items]).generate_state(simulations)
    outcomes = [study(cell, items, int(s), resamples=resamples, alpha=alpha) for s in seeds]
    return PowerPoint(
        items=items,
        power=sum(o.passed for o in outcomes) / simulations,
        power_nondegenerate=sum(o.passed_nondegenerate for o in outcomes) / simulations,
        pair_power=sum(o.first_pair_passed for o in outcomes) / simulations,
        simulations=simulations,
    )


def normal_approx_items(cell: Cell, *, alpha: float = ALPHA, power: float = 0.8) -> float:
    """Items for one pair at `power` by the normal approximation, true difference zero.

    The item-level difference has variance kappa * 2p(1 - p) divided by the
    number of independent seeds; equivalence at the margin needs
    margin / se of at least z(1 - alpha) + z(1 - (1 - power) / 2).
    """
    z = NormalDist().inv_cdf
    draws = cell.seeds if cell.seed_model == "independent" else 1
    variance = cell.kappa * 2 * cell.rate * (1 - cell.rate) / draws
    return variance * (z(1 - alpha) + z(1 - (1 - power) / 2)) ** 2 / cell.margin**2


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
    first rung below the target, so a region of small samples that pass only
    because they hold no discordant item is not entered from above.
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
