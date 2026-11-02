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
intersection-union test, which needs no multiplicity correction).

The TOST's level is checked at every size reported, exactly. With three
seeds an item's difference d lies on the lattice {-1, -2/3, ..., 1}, and the
TOST decides from (sum d, sum d^2); for any distribution of d the joint
distribution of those sums is the n-th power of one item's characteristic
function, inverted by FFT on a window that Bernstein's inequality bounds
(`lattice_sums`, `lattice_level`). `composite_sup` searches the composite
null, every lattice distribution with the mean on the margin (identical
seeds, independent seeds, any rates, any kappa), for its largest level;
the H4 script admits a size only if that is at most alpha and so are the
exact levels of the cell's own distributions on the margin.
`simulated_level` measures a level by simulation; the tests use it as an
independent check of the exact route.

The TOST decides from the sums of d and d^2 (`equivalent_from_sums`), which
are linear in the counts of the items' states; a simulated study is one
multinomial draw of those counts (`item_states`), the same distribution as
drawing every item, at a cost that does not grow with the study's size.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations, pairwise, product
from statistics import NormalDist
from typing import Any, Literal

import numpy as np
import numpy.typing as npt
from scipy.optimize import minimize  # type: ignore[import-untyped]  # no type stubs

from analysis.bootstrap import ALPHA, FloatArray
from analysis.equivalence import BoolArray, critical_z, equivalent_from_sums, variance_floor

SeedModel = Literal["independent", "identical"]
SEED_MODELS: tuple[SeedModel, ...] = ("identical", "independent")
IntArray = npt.NDArray[np.int64]


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


def item_states(
    rates: Sequence[float], kappa: float, seed_model: SeedModel, seeds: int
) -> tuple[IntArray, FloatArray]:
    """Every arm's violation count over an item's draws, and the probability of each.

    One draw: with probability 1 - kappa every arm reads one shared uniform
    and violates when it falls below the arm's rate (so the arms' outcomes
    are nested by rate); with probability kappa each arm reads its own. An
    item sums `seeds` independent draws (`independent`) or one (`identical`,
    whose draw every seed repeats). Returns the states, shape (K, arms), and
    their probabilities, shape (K,).
    """
    arms = len(rates)
    per_draw: dict[tuple[int, ...], float] = {}
    cuts = sorted({0.0, 1.0, *(float(r) for r in rates)})
    for low, high in pairwise(cuts):
        pattern = tuple(int(r >= high) for r in rates)
        per_draw[pattern] = per_draw.get(pattern, 0.0) + (1.0 - kappa) * (high - low)
    for pattern in product((0, 1), repeat=arms):
        chance = math.prod(r if v else 1.0 - r for r, v in zip(rates, pattern, strict=True))
        per_draw[pattern] = per_draw.get(pattern, 0.0) + kappa * chance
    states: dict[tuple[int, ...], float] = {(0,) * arms: 1.0}
    for _ in range(_draws(seed_model, seeds)):
        grown: dict[tuple[int, ...], float] = {}
        for state, p_state in states.items():
            for pattern, p_pattern in per_draw.items():
                key = tuple(a + b for a, b in zip(state, pattern, strict=True))
                grown[key] = grown.get(key, 0.0) + p_state * p_pattern
        states = grown
    keys = sorted(states)
    probs = np.array([states[k] for k in keys], dtype=np.float64)
    return np.array(keys, dtype=np.int64), probs / probs.sum()


def _pair_sums(
    counts: IntArray, states: IntArray, a: int, b: int, draws: int
) -> tuple[FloatArray, FloatArray]:
    d = (states[:, a] - states[:, b]).astype(np.float64) / draws
    total: FloatArray = counts @ d
    squares: FloatArray = counts @ (d * d)
    return total, squares


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
    """The share of `simulations` seeded studies whose every pair passes, at `items` per arm.

    A study is drawn as the counts of its items' states (`item_states`), one
    multinomial: the TOST needs only each pair's sums of d and d^2, which
    are linear in those counts, so a study costs the same at any size.
    """
    rng = np.random.default_rng(np.random.SeedSequence([seed, items, simulations]))
    states, probs = item_states([cell.rate] * cell.arms, cell.kappa, cell.seed_model, cell.seeds)
    counts = rng.multinomial(items, probs, size=simulations)
    draws = _draws(cell.seed_model, cell.seeds)
    passed = [
        equivalent_from_sums(*_pair_sums(counts, states, a, b, draws), items, cell.margin, alpha)
        for a, b in combinations(range(cell.arms), 2)
    ]
    return PowerPoint(
        items=items,
        power=float(np.logical_and.reduce(passed).mean()),
        pair_power=float(passed[0].mean()),
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
    worst = 0.0
    draws = _draws(seed_model, seeds)
    for direction, rates in enumerate(((rate, rate + margin), (rate + margin, rate))):
        rng = np.random.default_rng(
            np.random.SeedSequence(
                [seed, items, direction, round(kappa * 1_000_000), SEED_MODELS.index(seed_model)]
            )
        )
        states, probs = item_states(rates, kappa, seed_model, seeds)
        counts = rng.multinomial(items, probs, size=runs)
        decided = equivalent_from_sums(
            *_pair_sums(counts, states, 0, 1, draws), items, margin, alpha
        )
        worst = max(worst, float(decided.mean()))
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


LATTICE: IntArray = np.arange(-3, 4, dtype=np.int64)
"""Three times an item's difference over three seeds: d is one of -1, -2/3, ..., 1."""
FOLD = 1e-13
"""Bernstein's bound on the probability outside each window `lattice_sums` keeps."""
SUPPORTS: tuple[tuple[int, int], ...] = tuple((a, b) for a in (-3, -2, -1) for b in (1, 2, 3))
"""The three-point lattice supports {a/3, 0, b/3} the composite-null search starts from."""
GRID = 36
"""Values of the free share per three-point support before refinement."""
REFINE = 14
"""Golden-section steps around the best grid value."""
STARTS = 4
"""The best starting distributions the seven-point search climbs from."""


def lattice_probs(probs: Sequence[float] | FloatArray) -> FloatArray:
    """Seven probabilities, P(3d = -3), ..., P(3d = 3), checked."""
    p = np.asarray(probs, dtype=np.float64)
    if p.shape != (7,) or (p < 0.0).any() or abs(float(p.sum()) - 1.0) > 1e-9:
        raise ValueError("a lattice distribution is seven non-negative probabilities summing to 1")
    return p


def _half_width(variance: float, bound: float) -> float:
    """The h with 2 exp(-h^2 / (2 (variance + bound h / 3))) = FOLD (Bernstein's inequality)."""
    log = math.log(2.0 / FOLD)
    return bound * log / 3.0 + math.sqrt((bound * log / 3.0) ** 2 + 2.0 * variance * log)


def _sums_window(probs: FloatArray, items: int) -> tuple[int, int, int, int, float]:
    """Windows of 3 sum d and 9 sum d^2, and a bound on the probability outside them."""
    support = probs > 0.0
    squares = LATTICE * LATTICE
    mean_t, mean_q = float(probs @ LATTICE), float(probs @ squares)
    var_t = items * float(probs @ (LATTICE - mean_t) ** 2)
    var_q = items * float(probs @ (squares - mean_q) ** 2)
    h_t = _half_width(var_t, float(np.max(np.abs(LATTICE - mean_t)[support])))
    h_q = _half_width(var_q, float(np.max(np.abs(squares - mean_q)[support])))
    t0 = max(-3 * items, math.floor(items * mean_t - h_t))
    t1 = min(3 * items, math.ceil(items * mean_t + h_t))
    q0 = max(0, math.floor(items * mean_q - h_q))
    q1 = min(9 * items, math.ceil(items * mean_q + h_q))
    tail = (0.0 if (t0, t1) == (-3 * items, 3 * items) else FOLD) + (
        0.0 if (q0, q1) == (0, 9 * items) else FOLD
    )
    return t0, t1, q0, q1, tail


def _fast_size(n: int) -> int:
    """The smallest 5-smooth number at least n: a fast FFT length."""
    size = n
    while True:
        rest = size
        for factor in (2, 3, 5):
            while rest % factor == 0:
                rest //= factor
        if rest == 1:
            return size
        size += 1


def lattice_sums(probs: FloatArray, items: int) -> tuple[FloatArray, int, int, float]:
    """The joint distribution of (3 sum d, 9 sum d^2) over `items` items, d drawn from `probs`.

    The items' characteristic function, one item's to the power `items`, on a
    torus as wide as the windows `_sums_window` picks, inverted by FFT: entry
    (i, k) is P(3 sum d = t0 + i, 9 sum d^2 = q0 + k), except that the
    probability outside the windows, at most `tail` by Bernstein's
    inequality, folds onto the torus. Returns the table, t0, q0 and tail.
    """
    if items < 1:
        raise ValueError("the sums need at least one item")
    t0, t1, q0, q1, tail = _sums_window(probs, items)
    rows, cols = t1 - t0 + 1, q1 - q0 + 1
    size_t, size_q = _fast_size(rows), _fast_size(cols)
    # The distribution is real, so half the spectrum along one axis carries it.
    phase_t = np.exp(-2j * np.pi * np.outer(np.fft.fftfreq(size_t), LATTICE))
    phase_q = np.exp(-2j * np.pi * np.outer(np.fft.rfftfreq(size_q), LATTICE * LATTICE))
    one = np.asarray((phase_t * probs) @ phase_q.T, dtype=np.complex128)
    power: npt.NDArray[np.complex128] | None = None
    exponent = items
    while exponent:
        if exponent & 1:
            power = one.copy() if power is None else power * one
        exponent >>= 1
        if exponent:
            one = one * one
    assert power is not None
    table = np.fft.irfft2(power, s=(size_t, size_q))
    table = np.roll(table, (-(t0 % size_t), -(q0 % size_q)), axis=(0, 1))[:rows, :cols]
    return table, t0, q0, tail


def _decisions(
    t: tuple[int, int], q: tuple[int, int], items: int, margin: float, alpha: float
) -> BoolArray:
    """The TOST's decision at every (3 sum d, 9 sum d^2) of a window."""
    totals = np.arange(t[0], t[1] + 1, dtype=np.float64)[:, None] / 3.0
    squares = np.arange(q[0], q[1] + 1, dtype=np.float64)[None, :] / 9.0
    total, square = np.broadcast_arrays(totals, squares)
    return equivalent_from_sums(total, square, items, margin, alpha)


def lattice_level(
    items: int, margin: float, alpha: float, probs: Sequence[float] | FloatArray
) -> float:
    """The TOST's level, exactly, when every item's d is drawn from `probs` on the lattice.

    The probability outside the windows is added, so the value is never below
    the true level by more than floating-point rounding (about 1e-12).
    """
    p = lattice_probs(probs)
    table, t0, q0, tail = lattice_sums(p, items)
    rows, cols = table.shape
    decided = _decisions((t0, t0 + rows - 1), (q0, q0 + cols - 1), items, margin, alpha)
    return float(np.sum(table * decided)) + tail


def lattice_level_gradient(
    items: int, margin: float, alpha: float, probs: Sequence[float] | FloatArray
) -> tuple[float, FloatArray]:
    """The level and its derivative in each probability.

    The level is a polynomial in the seven probabilities, homogeneous of
    degree `items`; its derivative in P(3d = k) is `items` times the level
    with one item fixed at k and the other `items` - 1 drawn, and the level is
    the probabilities' dot product with the derivatives over `items`.
    """
    p = lattice_probs(probs)
    table, t0, q0, tail = lattice_sums(p, items - 1)
    rows, cols = table.shape
    decided = _decisions((t0 - 3, t0 + rows + 2), (q0, q0 + cols + 8), items, margin, alpha)
    gradient = np.array(
        [
            items * float(np.sum(table * decided[3 + k : 3 + k + rows, k * k : k * k + cols]))
            for k in LATTICE
        ]
    )
    return float(p @ gradient) / items + tail, gradient


def on_margin(probs: Sequence[float] | FloatArray, margin: float) -> FloatArray:
    """`probs` clipped at 0, normalised, and mixed with a point mass so the mean is -margin.

    The point mass is at -1 when the mean is above -margin, at 0 when below.
    """
    p = np.clip(np.asarray(probs, dtype=np.float64), 0.0, None)
    p = p / p.sum()
    mean = float(p @ LATTICE) / 3.0
    if mean > -margin:
        share, point = (mean + margin) / (mean + 1.0), 0
    else:
        share, point = 1.0 + margin / mean, 3
    p = (1.0 - share) * p
    p[point] += share
    return p


def difference_distribution(
    rates: tuple[float, float], kappa: float, seed_model: SeedModel, seeds: int = 3
) -> FloatArray:
    """P(3d = k) for d the seed-averaged difference, first arm minus second (`item_states`)."""
    if seeds != 3:
        raise ValueError("the lattice of differences is for three seeds")
    states, probs = item_states(list(rates), kappa, seed_model, seeds)
    out = np.zeros(7)
    np.add.at(out, (states[:, 0] - states[:, 1]) * (3 // _draws(seed_model, seeds)) + 3, probs)
    return out


def three_point_level(
    items: int, margin: float, alpha: float, a: int, b: int, share: float
) -> float:
    """The TOST's level, exactly, when d is a/3, 0 or b/3 with mean -margin and P(b/3) = share.

    P(a/3) is then (3 margin + b share) / (-a). The level is a sum over the
    trinomial counts of the two non-zero values; the probability outside the
    counts summed (well below 1e-15) is added back, so the value is never
    below the true level.
    """
    low = (3.0 * margin + b * share) / (-a)
    if low + share > 1.0 + 1e-12:
        raise ValueError("no distribution on that support has its mean on the margin")
    log_f = _log_factorials(items)

    def counts(p: float) -> IntArray:
        if p <= 0.0:
            return np.zeros(1, dtype=np.int64)
        spread = 9.0 * math.sqrt(items * p * (1.0 - p)) + 3.0
        first = max(0, int(items * p - spread))
        last = min(items, int(items * p + spread) + 1)
        return np.arange(first, last + 1, dtype=np.int64)

    x, y = np.meshgrid(counts(low), counts(share), indexing="ij")
    ok = x + y <= items
    x, y = x[ok], y[ok]
    zero = items - x - y
    log_p = log_f[items] - log_f[x] - log_f[y] - log_f[zero]
    if low > 0.0:
        log_p = log_p + x * math.log(low)
    if share > 0.0:
        log_p = log_p + y * math.log(share)
    rest = 1.0 - low - share
    # With nothing left for zero, any count of zeros is impossible.
    rest_term = zero * math.log(rest) if rest > 0.0 else np.where(zero > 0, -np.inf, 0.0)
    mass = np.exp(log_p + rest_term)
    decided = equivalent_from_sums(
        (a * x + b * y) / 3.0, (a * a * x + b * b * y) / 9.0, items, margin, alpha
    )
    return float(np.sum(mass * decided)) + max(0.0, 1.0 - float(np.sum(mass)))


def three_point(a: int, b: int, share: float, margin: float) -> FloatArray:
    """The distribution on {a/3, 0, b/3} with mean -margin and P(b/3) = share."""
    p = np.zeros(7)
    p[a + 3] += (3.0 * margin + b * share) / (-a)
    p[b + 3] += share
    p[3] += 1.0 - p.sum()
    return p


def _support_sup(items: int, margin: float, alpha: float, a: int, b: int) -> tuple[float, float]:
    top = (-a - 3.0 * margin) / (b - a)
    grid = [0.0, *np.geomspace(1e-5, top, GRID).tolist()]
    values = [three_point_level(items, margin, alpha, a, b, q) for q in grid]
    i = int(np.argmax(values))
    best, at = values[i], grid[i]
    lo, hi = grid[max(0, i - 1)], grid[min(len(grid) - 1, i + 1)]
    golden = (math.sqrt(5.0) - 1.0) / 2.0
    for _ in range(REFINE):
        left, right = hi - golden * (hi - lo), lo + golden * (hi - lo)
        lv = three_point_level(items, margin, alpha, a, b, left)
        rv = three_point_level(items, margin, alpha, a, b, right)
        for v, q in ((lv, left), (rv, right)):
            if v > best:
                best, at = v, q
        if lv >= rv:
            hi = right
        else:
            lo = left
    return best, at


def round_up(level: float) -> float:
    """A level rounded up to the six decimals results keep: never below the value."""
    return math.ceil(level * 1e6) / 1e6


def composite_sup(items: int, margin: float, alpha: float = ALPHA) -> dict[str, Any]:
    """See `_composite_sup`; cached, since every cell of a margin asks for the same sizes."""
    level, probs, found = _composite_sup(items, margin, alpha)
    return {"level": round_up(level), "probs": list(probs), "found": found}


@lru_cache(maxsize=1024)
def _composite_sup(items: int, margin: float, alpha: float) -> tuple[float, tuple[float, ...], str]:
    """The largest level found over every null distribution the three-seed design allows.

    The composite null on the lower boundary: every distribution of d on the
    seven-point lattice {-1, -2/3, ..., 1} with mean -margin. It holds every
    identical-seed distribution (d in {-1, 0, 1}, the whole boundary, not a
    kappa grid) and every independent-seed one, at any rates and kappa. The
    upper boundary is its mirror image and has the same levels.

    The search: the kappa-0 distribution of independent seeds; every
    three-point support {a/3, 0, b/3}, over a grid of its free share refined
    by golden section (`three_point_level`); then, from the STARTS best of
    those, a climb over all seven probabilities by SLSQP with the exact
    gradient (`lattice_level_gradient`), each end point put back on the
    margin and its level computed exactly. Every level reported is exact and
    rounded up; the maximum over distributions is numerical, so the value is
    the largest level found, a lower bound on the supremum.
    research/tests/test_equivalence.py checks it against a fine grid of the
    identical-seed boundary and a random search over the whole lattice.
    """
    q = [math.comb(3, j) * margin**j * (1.0 - margin) ** (3 - j) for j in range(4)]
    kappa_0 = np.array([q[3], q[2], q[1], q[0], 0.0, 0.0, 0.0])
    starts: list[tuple[float, FloatArray, str]] = [
        (exact_level(margin, items, "independent", alpha=alpha), kappa_0, "independent, kappa 0")
    ]
    for a, b in SUPPORTS:
        level, share = _support_sup(items, margin, alpha, a, b)
        starts.append((level, three_point(a, b, share, margin), f"{a}/3, 0, {b}/3"))
    starts.sort(key=lambda s: -s[0])
    best = starts[0]
    constraints = (
        {"type": "eq", "fun": lambda p: float(p.sum()) - 1.0, "jac": lambda p: np.ones(7)},
        {
            "type": "eq",
            "fun": lambda p: float(p @ LATTICE) / 3.0 + margin,
            "jac": lambda p: LATTICE / 3.0,
        },
    )

    def objective(x: FloatArray) -> tuple[float, FloatArray]:
        p = np.clip(x, 0.0, None)
        level, gradient = lattice_level_gradient(items, margin, alpha, p / p.sum())
        return -level, -gradient

    for _, start, name in starts[:STARTS]:
        climbed = minimize(
            objective,
            start,
            jac=True,
            method="SLSQP",
            bounds=[(0.0, 1.0)] * 7,
            constraints=constraints,
            options={"maxiter": 200, "ftol": 1e-12},
        )
        p = on_margin(climbed.x, margin)
        level = lattice_level(items, margin, alpha, p)
        if level > best[0]:
            best = (level, p, f"seven-point climb from {name}")
    return best[0], tuple(float(x) for x in best[1]), best[2]


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
