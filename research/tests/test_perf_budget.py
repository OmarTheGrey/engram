"""The plane-overhead result (card X15): percentiles, the budget, and the rerun check.

The suite itself is TypeScript (packages/core/bench, tested by
packages/core/test/bench/count.test.ts); these tests feed perf_budget.py
small synthetic samples files, so they need no node and no timing.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from scripts import perf_budget
from scripts.results_io import REPO, dumps_result, load_config

PRESETS = ["strict", "medium", "permissive"]
OPS = ["write", "write-deny", "read"]
SUITE = {
    "stores": ["fake"],
    "sizes": [100],
    "presets": PRESETS,
    "hits": 10,
    "at": "2026-11-21T12:00:00Z",
    "iterations": {"100": 4},
    "warmup": 1,
}
MACHINE = {"cpu": "cpu", "cores": 2, "memory_bytes": 1, "os": "os", "arch": "x64"}
Q = {"prepares": 1, "statements": 2, "rows": 3, "execs": 0, "transactions": 1}
START = {"items": 100, "events": 100}


def config(percentiles: list[float] | None = None) -> dict[str, Any]:
    return {
        "hypothesis": "none",
        "filed_under": "synthetic",
        "samples": "samples.jsonl",
        "suite": SUITE,
        "percentiles": percentiles or [50, 99, 99.9],
        "baseline_of": {
            "write": {"op": "sqlite-write"},
            "write-deny": {"op": "sqlite-write"},
            "read": {"op": "sqlite-read"},
        },
        "tolerance": {
            "median_band": 3.0,
            "baseline_band": 4.0,
            "aggregate_band": 1.5,
            "machine_keys": ["cpu", "cores", "memory_bytes", "os", "arch"],
        },
        "budget": [
            {
                "name": "read",
                "store": "fake",
                "size": 100,
                "preset": "medium",
                "op": "read",
                "stat": "p99",
                "limit_ms": 10.0,
                "max_ratio": 100.0,
            }
        ],
        "notes": ["synthetic"],
    }


def cell(
    store: str, preset: str | None, op: str, samples: list[float], queries: Any
) -> dict[str, Any]:
    return {
        "record": "cell",
        "store": store,
        "size": 100,
        "preset": preset,
        "op": op,
        "iterations": len(samples),
        "warmup": 1,
        "samples_ms": samples,
        "queries": queries,
        "start": START,
    }


def records(
    scale: Mapping[tuple[str, str], float] | float = 1.0,
    queries: Any = Q,
    machine: Any = MACHINE,
    node: str = "v24",
) -> list[dict[str, Any]]:
    """A samples file; `scale` multiplies every cell, or the plane cells it names."""
    header = {
        "record": "header",
        "suite": SUITE,
        "node": node,
        "tinybench": "6.2.3",
        "machine": machine,
    }

    def factor(preset: str, op: str) -> float:
        return scale if isinstance(scale, float) else scale.get((preset, op), 1.0)

    plane = [
        cell(
            "fake",
            preset,
            op,
            [factor(preset, op) * v for v in (4.0, 1.0, 2.0, 3.0)],
            queries,
        )
        for preset in PRESETS
        for op in OPS
    ]
    every = scale if isinstance(scale, float) else 1.0
    base = [
        cell("sqlite", None, op, [every * v for v in (0.1, 0.2, 0.3, 0.4)], None)
        for op in ("sqlite-write", "sqlite-read")
    ]
    return [
        header,
        *base,
        {"record": "populate", "store": "fake", "size": 100, "ms": 500.0},
        *plane,
    ]


def write(path: Path, lines: list[dict[str, Any]]) -> Path:
    path.write_text("".join(json.dumps(r) + "\n" for r in lines), encoding="utf-8")
    return path


def check(tmp_path: Path, new: list[dict[str, Any]]) -> list[str]:
    old = write(tmp_path / "old.jsonl", records())
    return perf_budget.rerun_check(config(), old, write(tmp_path / "new.jsonl", new))


def test_percentile_is_numpys_linear_interpolation() -> None:
    samples = sorted([3.0, 1.0, 7.5, 2.25, 10.0, 0.5, 4.0])
    for q in (0, 25, 50, 90, 99, 99.9, 100):
        assert perf_budget.percentile(samples, q) == pytest.approx(np.percentile(samples, q))


def test_the_result_has_percentiles_ratios_population_and_budget(tmp_path: Path) -> None:
    result = perf_budget.build(config(), write(tmp_path / "s.jsonl", records()))
    assert result["hypothesis"] == "none"
    read = next(c for c in result["cells"] if c["op"] == "read" and c["preset"] == "medium")
    assert read["p50_ms"] == pytest.approx(2.5)
    assert read["n"] == 4 and read["queries"] == Q and read["start"] == START
    over = next(o for o in result["overhead"] if o["op"] == "read")
    assert over["baseline_op"] == "sqlite-read"
    assert over["p50_ratio"] == pytest.approx(2.5 / 0.25)
    assert set(over) >= {"p50_ratio", "p99_ratio", "p999_ratio"}
    assert result["population"] == [
        {"store": "fake", "size": 100, "seconds": 0.5, "mean_write_ms": 5.0}
    ]
    [rule] = result["budget"]
    assert rule["met"] is True and rule["measured_ms"] == pytest.approx(
        perf_budget.percentile([1.0, 2.0, 3.0, 4.0], 99)
    )


def test_the_overhead_follows_the_configs_percentiles(tmp_path: Path) -> None:
    without_99 = config([50, 99.9])
    without_99["budget"][0]["stat"] = "p999"
    result = perf_budget.build(without_99, write(tmp_path / "s.jsonl", records()))
    for row in result["overhead"]:
        assert "p99_ratio" not in row and {"p50_ratio", "p999_ratio"} <= set(row)
    assert all("p99_ms" not in c for c in result["cells"])


def test_the_baseline_a_cell_is_compared_with_comes_from_the_config(tmp_path: Path) -> None:
    other = config()
    other["baseline_of"]["write-deny"] = {"op": "sqlite-read"}
    result = perf_budget.build(other, write(tmp_path / "s.jsonl", records()))
    deny = next(o for o in result["overhead"] if o["op"] == "write-deny")
    assert deny["baseline_op"] == "sqlite-read"


def test_a_budget_over_its_limit_is_not_met(tmp_path: Path) -> None:
    tight = config()
    tight["budget"][0]["limit_ms"] = 1.0
    result = perf_budget.build(tight, write(tmp_path / "s.jsonl", records()))
    assert result["budget"][0]["met"] is False


def test_the_result_is_byte_stable(tmp_path: Path) -> None:
    path = write(tmp_path / "s.jsonl", records())
    first = dumps_result(perf_budget.build(config(), path))
    assert dumps_result(perf_budget.build(config(), path)) == first


def test_samples_of_another_suite_block_are_refused(tmp_path: Path) -> None:
    other = config()
    other["suite"] = {**SUITE, "hits": 5}
    with pytest.raises(ValueError, match="another suite block"):
        perf_budget.build(other, write(tmp_path / "s.jsonl", records()))


def test_the_rerun_check_passes_inside_both_bands(tmp_path: Path) -> None:
    assert check(tmp_path, records(scale=1.4)) == []


def test_one_cell_outside_the_per_cell_band_fails(tmp_path: Path) -> None:
    problems = check(tmp_path, records(scale={("medium", "read"): 3.2}))
    assert problems == [
        "('fake', 100, 'medium', 'read'): median moved by 3.200, outside 1/3.0 to 3.0"
    ]


def test_a_bare_cell_is_judged_by_the_wider_baseline_band(tmp_path: Path) -> None:
    new = records()
    for r in new:
        if r.get("op") == "sqlite-read":
            r["samples_ms"] = [3.5 * v for v in r["samples_ms"]]
    assert check(tmp_path, new) == []
    for r in new:
        if r.get("op") == "sqlite-read":
            r["samples_ms"] = [1.2 * v for v in r["samples_ms"]]
    problems = check(tmp_path, new)
    assert problems == [
        "('sqlite', 100, '', 'sqlite-read'): median moved by 4.200, outside 1/4.0 to 4.0"
    ]


def test_every_read_cell_twice_as_slow_fails_on_the_geometric_mean(tmp_path: Path) -> None:
    """Review finding X15-3: the per-cell band admits 2x, the aggregate band does not."""
    slow = records(scale={(p, "read"): 2.0 for p in PRESETS})
    problems = check(tmp_path, slow)
    assert problems == ["read: the geometric mean of its median ratios is 2.000, above 1.5"]


def test_every_cell_faster_passes_the_one_sided_aggregate_band(tmp_path: Path) -> None:
    """The lead's decision after the fix pass: a faster run is not a regression."""
    fast = records(scale={(p, op): 0.4 for p in PRESETS for op in OPS})
    assert check(tmp_path, fast) == []


def test_the_rerun_check_fails_on_a_changed_query_count(tmp_path: Path) -> None:
    problems = check(tmp_path, records(queries={**Q, "rows": 4}))
    assert len(problems) == 9 and all("queries differ" in p for p in problems)


def test_the_rerun_check_fails_on_a_changed_starting_log(tmp_path: Path) -> None:
    new = records()
    for r in new:
        if r.get("store") == "fake" and r.get("op") == "read":
            r["start"] = {"items": 101, "events": 100}
    problems = check(tmp_path, new)
    assert len(problems) == 3 and all("start differ" in p for p in problems)


def test_the_rerun_check_refuses_another_machine(tmp_path: Path) -> None:
    elsewhere = copy.deepcopy(MACHINE) | {"cpu": "another cpu"}
    [problem] = check(tmp_path, records(machine=elsewhere))
    assert problem.startswith("cpu differs") and "not compared across machines" in problem


def test_the_rerun_check_refuses_another_node_version(tmp_path: Path) -> None:
    [problem] = check(tmp_path, records(node="v26"))
    assert problem.startswith("node differs")


def test_the_committed_samples_match_the_committed_config() -> None:
    committed = load_config(REPO / "research/configs/perf-budget.json")
    header, _, cells = perf_budget.read_samples(REPO / committed["samples"])
    assert header["suite"] == committed["suite"]
    assert len(cells) > 0 and all("start" in c for c in cells)
