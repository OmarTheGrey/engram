"""H4's sample size by seeded simulation with the analysis code's own TOST (plan decision 2).

H4 says the violation rate under C5 does not depend on the store or the model:
every pairwise equivalence across the three stores (and across the three
models) holds within a margin, by two one-sided tests (`analysis.bootstrap.tost`).
v0.1 sized it from a pilot, which needs a model key; this module replaces the
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
intersection-union test, which needs no multiplicity correction). Its level
is checked, not assumed: `size_at_margin` puts one pair's true difference on
the margin, either way, and counts how often equivalence is declared.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
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


def simulate_arms(
    rates: Sequence[float],
    kappa: float,
    seed_model: SeedModel,
    seeds: int,
    items: int,
    rng: np.random.Generator,
) -> FloatArray:
    """Seed-averaged outcomes, shape (arms, items), one arm per rate (see the module docstring)."""
    draws = seeds if seed_model == "independent" else 1
    shared = rng.random((items, draws))
    split = rng.random((items, draws)) < kappa
    own = rng.random((len(rates), items, draws))
    uniform = np.where(split[None, :, :], own, shared[None, :, :])
    outcomes = uniform < np.asarray(rates, dtype=np.float64)[:, None, None]
    means: FloatArray = outcomes.mean(axis=2, dtype=np.float64)
    return means


def simulate_items(cell: Cell, items: int, rng: np.random.Generator) -> FloatArray:
    """The cell's arms at its common rate, shape (arms, items)."""
    return simulate_arms(
        [cell.rate] * cell.arms, cell.kappa, cell.seed_model, cell.seeds, items, rng
    )


def study(
    cell: Cell, items: int, seed: int, *, resamples: int = RESAMPLES, alpha: float = ALPHA
) -> tuple[bool, bool]:
    """One simulated H4 study at `items` items: (every pair passed, the first pair passed)."""
    seq = np.random.SeedSequence(seed)
    data_seed, *pair_seeds = seq.generate_state(1 + cell.arms * (cell.arms - 1) // 2)
    values = simulate_items(cell, items, np.random.default_rng(int(data_seed)))
    passed = [
        tost(
            values[a] - values[b],
            margin=cell.margin,
            seed=int(pair_seed),
            resamples=resamples,
            alpha=alpha,
        ).equivalent
        for (a, b), pair_seed in zip(combinations(range(cell.arms), 2), pair_seeds, strict=True)
    ]
    return all(passed), passed[0]


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
    resamples: int = RESAMPLES,
    alpha: float = ALPHA,
) -> PowerPoint:
    """The share of `simulations` seeded studies that pass, at `items` items per arm."""
    seeds = np.random.SeedSequence([seed, items, simulations]).generate_state(simulations)
    outcomes = [study(cell, items, int(s), resamples=resamples, alpha=alpha) for s in seeds]
    return PowerPoint(
        items=items,
        power=sum(o[0] for o in outcomes) / simulations,
        pair_power=sum(o[1] for o in outcomes) / simulations,
        simulations=simulations,
    )


def size_at_margin(
    cell: Cell,
    items: int,
    *,
    simulations: int,
    seed: int,
    kappa: float | None = None,
    resamples: int = RESAMPLES,
    alpha: float = ALPHA,
) -> float:
    """How often one pair is declared equivalent when its true difference is on the margin.

    The pair's rates are (p, p + margin) and (p + margin, p), each `simulations`
    times, under the cell's seed model and its kappa (or `kappa`); the larger
    of the two rates is returned.
    """
    rates = (cell.rate, cell.rate + cell.margin)
    worst = 0.0
    for direction, pair in enumerate((rates, rates[::-1])):
        seeds = np.random.SeedSequence([seed, items, direction]).generate_state(simulations)
        passed = 0
        for s in seeds:
            data_seed, test_seed = np.random.SeedSequence(int(s)).generate_state(2)
            values = simulate_arms(
                pair,
                cell.kappa if kappa is None else kappa,
                cell.seed_model,
                cell.seeds,
                items,
                np.random.default_rng(int(data_seed)),
            )
            passed += tost(
                values[0] - values[1],
                margin=cell.margin,
                seed=int(test_seed),
                resamples=resamples,
                alpha=alpha,
            ).equivalent
        worst = max(worst, passed / simulations)
    return worst


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
    number of independent seeds; each one-sided test is held to alpha / 2
    (`tost`), so a pair passes when |difference| / se < margin / se -
    z(1 - alpha / 2). One pair needs margin / se of at least that z plus
    z(1 - (1 - power) / 2); all three pairs need it plus `joint_threshold`.
    """
    z = NormalDist().inv_cdf
    draws = cell.seeds if cell.seed_model == "independent" else 1
    variance = cell.kappa * 2 * cell.rate * (1 - cell.rate) / draws
    spread = joint_threshold(power) if joint else z(1 - (1 - power) / 2)
    return variance * (z(1 - alpha / 2) + spread) ** 2 / cell.margin**2


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
