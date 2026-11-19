"""H1's effect sizes (research/analysis/effects.py), on planted data (card X4).

The relative reduction is recovered where it is planted, its rates are the
contrast's pairs so their difference is the contrast's mean, its interval is
seeded and stable, and a zero reference rate gives null rather than a number.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from analysis.bootstrap import Session, paired_bootstrap, paired_item_differences
from analysis.effects import paired_rates, relative_reduction
from analysis.h1 import H1Config, build_h1_table, read_sessions


def planted(seed: int, items: int, rate: float, *, excluded: float = 0.0) -> list[Session]:
    rng = np.random.default_rng(seed)
    out: list[Session] = []
    for i in range(items):
        for s in (1, 2, 3):
            outcome: float | None = float(rng.random() < rate)
            if rng.random() < excluded:
                outcome = None
            out.append((f"item-{i:03d}", s, outcome))
    return out


def test_a_planted_relative_reduction_is_recovered_with_its_interval() -> None:
    c4, c5 = planted(1, 600, 0.25), planted(2, 600, 0.05)
    effect = relative_reduction(c4, c5, seed=11)
    assert effect["registered"] is False
    assert effect["n"] == 600
    assert effect["relative_reduction"] == pytest.approx(0.8, abs=0.06)
    assert effect["low"] < 0.8 < effect["high"]
    assert effect["low"] < effect["relative_reduction"] < effect["high"]
    assert effect["undefined_resamples"] == 0


def test_the_rates_are_the_contrasts_pairs_so_their_difference_is_its_mean() -> None:
    """Uneven exclusions: the paired rates follow the test, not each condition's own rate."""
    c4, c5 = planted(3, 200, 0.3, excluded=0.2), planted(4, 200, 0.1, excluded=0.1)
    _, diffs = paired_item_differences(c4, c5)
    contrast = paired_bootstrap(diffs, seed=5, resamples=1_000)
    effect = relative_reduction(c4, c5, seed=6, resamples=1_000)
    assert effect["difference"] == pytest.approx(contrast.mean, abs=1e-12)
    assert effect["rate_first"] - effect["rate_second"] == pytest.approx(contrast.mean, abs=1e-12)
    assert effect["n"] == contrast.n


def test_paired_rates_drop_an_item_seed_either_condition_excluded() -> None:
    a: list[Session] = [("x", 1, 1.0), ("x", 2, None), ("x", 3, 1.0), ("y", 1, 0.0)]
    b: list[Session] = [("x", 1, 0.0), ("x", 2, 0.0), ("x", 3, None), ("y", 1, None)]
    items, x, y = paired_rates(a, b)
    assert items == ["x"]
    assert x.tolist() == [1.0] and y.tolist() == [0.0]


def test_the_interval_is_seeded() -> None:
    c4, c5 = planted(7, 100, 0.3), planted(8, 100, 0.1)
    first = relative_reduction(c4, c5, seed=9, resamples=2_000)
    assert first == relative_reduction(c4, c5, seed=9, resamples=2_000)
    assert first != relative_reduction(c4, c5, seed=10, resamples=2_000)


def test_every_violation_removed_is_a_reduction_of_one() -> None:
    a: list[Session] = [(f"i{k}", 1, 1.0) for k in range(20)]
    b: list[Session] = [(f"i{k}", 1, 0.0) for k in range(20)]
    effect = relative_reduction(a, b, seed=1, resamples=500)
    assert (effect["relative_reduction"], effect["low"], effect["high"]) == (1.0, 1.0, 1.0)


def test_a_zero_reference_rate_has_no_relative_reduction() -> None:
    a: list[Session] = [(f"i{k}", 1, 0.0) for k in range(20)]
    b: list[Session] = [(f"i{k}", 1, float(k == 0)) for k in range(20)]
    effect = relative_reduction(a, b, seed=1, resamples=500)
    assert effect["difference"] == pytest.approx(-0.05)
    assert (effect["relative_reduction"], effect["low"], effect["high"]) == (None, None, None)


def test_resamples_with_a_zero_reference_rate_are_counted_and_left_out() -> None:
    """One violating item of ten under a: about 0.9 ** 10 = 35 percent of resamples miss it."""
    a: list[Session] = [(f"i{k}", 1, float(k == 0)) for k in range(10)]
    b: list[Session] = [(f"i{k}", 1, 0.0) for k in range(10)]
    effect = relative_reduction(a, b, seed=2, resamples=4_000)
    assert 0.30 * 4_000 < effect["undefined_resamples"] < 0.40 * 4_000
    assert (effect["low"], effect["high"]) == (1.0, 1.0)


def test_no_item_kept_under_both_is_refused() -> None:
    with pytest.raises(ValueError):
        relative_reduction([("x", 1, None)], [("x", 1, 0.0)], seed=1)


def test_every_contrast_of_the_h1_table_carries_its_effect_sizes(tmp_path: Path) -> None:
    rows = []
    for condition, rate, seed in (("C2", 0.4, 1), ("C3", 0.3, 2), ("C4", 0.25, 3), ("C5", 0.05, 4)):
        for item, s, outcome in planted(seed, 150, rate):
            rows.append(
                {
                    "benchmark": "gatemem",
                    "model": "provider/m1",
                    "store": "fake",
                    "preset": "none" if condition == "C2" else "medium",
                    "condition": condition,
                    "item": item,
                    "seed": s,
                    "violation": bool(outcome),
                }
            )
    path = tmp_path / "sessions.jsonl"
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    table = build_h1_table(
        read_sessions(path), H1Config(primary_model="provider/m1", store="fake", seed=3)
    )
    assert table["schema"] == "h1-table/3"
    assert {c["contrast"] for c in table["contrasts"]} == {"C4-C5", "C3-C5", "C2-C5"}
    for contrast in table["contrasts"]:
        effect = contrast["effect"]
        assert effect["difference"] == pytest.approx(contrast["mean"], abs=1e-12)
        assert effect["low"] <= effect["relative_reduction"] <= effect["high"]
    assert table["primary"]["effect"]["relative_reduction"] == pytest.approx(0.8, abs=0.12)
