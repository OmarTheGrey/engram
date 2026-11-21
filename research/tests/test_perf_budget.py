"""The plane-overhead result (card X15): percentiles, the budget, and the rerun check.

The suite itself is TypeScript (packages/core/bench, tested by
packages/core/test/bench/count.test.ts); these tests feed perf_budget.py
small synthetic samples files, so they need no node and no timing.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from scripts import perf_budget
from scripts.results_io import REPO, dumps_result, load_config

SUITE = {
    "stores": ["fake"],
    "sizes": [100],
    "presets": ["medium"],
    "hits": 10,
    "at": "2026-11-21T12:00:00Z",
    "iterations": {"100": 4},
    "warmup": 1,
}
MACHINE = {"cpu": "cpu", "cores": 2, "memory_bytes": 1, "os": "os", "arch": "x64"}
Q = {"prepares": 1, "statements": 2, "execs": 0, "transactions": 1}


def config() -> dict[str, Any]:
    return {
        "hypothesis": "H2",
        "samples": "samples.jsonl",
        "suite": SUITE,
        "percentiles": [50, 99, 99.9],
        "tolerance": {"median_band": 2.0},
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
    }


def records(scale: float = 1.0, queries: Any = Q, machine: Any = MACHINE) -> list[dict[str, Any]]:
    header = {
        "record": "header",
        "suite": SUITE,
        "node": "v24",
        "tinybench": "6.2.3",
        "machine": machine,
    }
    plane = [
        cell("fake", "medium", op, [scale * v for v in (4.0, 1.0, 2.0, 3.0)], queries)
        for op in ("write", "write-deny", "read")
    ]
    base = [
        cell("sqlite", None, op, [scale * v for v in (0.1, 0.2, 0.3, 0.4)], None)
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


def test_percentile_is_numpys_linear_interpolation() -> None:
    samples = sorted([3.0, 1.0, 7.5, 2.25, 10.0, 0.5, 4.0])
    for q in (0, 25, 50, 90, 99, 99.9, 100):
        assert perf_budget.percentile(samples, q) == pytest.approx(np.percentile(samples, q))


def test_the_result_has_percentiles_ratios_population_and_budget(tmp_path: Path) -> None:
    result = perf_budget.build(config(), write(tmp_path / "s.jsonl", records()))
    read = next(c for c in result["cells"] if c["op"] == "read")
    assert read["p50_ms"] == pytest.approx(2.5)
    assert read["n"] == 4 and read["queries"] == Q
    over = next(o for o in result["overhead"] if o["op"] == "read")
    assert over["baseline_op"] == "sqlite-read"
    assert over["p50_ratio"] == pytest.approx(2.5 / 0.25)
    assert result["population"] == [
        {"store": "fake", "size": 100, "seconds": 0.5, "mean_write_ms": 5.0}
    ]
    [rule] = result["budget"]
    assert rule["met"] is True and rule["measured_ms"] == pytest.approx(
        perf_budget.percentile([1.0, 2.0, 3.0, 4.0], 99)
    )


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


def test_the_rerun_check_passes_inside_the_band(tmp_path: Path) -> None:
    old = write(tmp_path / "old.jsonl", records())
    new = write(tmp_path / "new.jsonl", records(scale=1.9))
    assert perf_budget.rerun_check(config(), old, new) == []


def test_the_rerun_check_fails_outside_the_band(tmp_path: Path) -> None:
    old = write(tmp_path / "old.jsonl", records())
    new = write(tmp_path / "new.jsonl", records(scale=2.1))
    problems = perf_budget.rerun_check(config(), old, new)
    assert problems and all("outside 1/2.0 to 2.0" in p for p in problems)


def test_the_rerun_check_fails_on_a_changed_query_count(tmp_path: Path) -> None:
    old = write(tmp_path / "old.jsonl", records())
    new = write(tmp_path / "new.jsonl", records(queries={**Q, "statements": 3}))
    problems = perf_budget.rerun_check(config(), old, new)
    assert len(problems) == 3 and all("query counts differ" in p for p in problems)


def test_the_rerun_check_refuses_another_machine(tmp_path: Path) -> None:
    old = write(tmp_path / "old.jsonl", records())
    elsewhere = copy.deepcopy(MACHINE) | {"cpu": "another cpu"}
    new = write(tmp_path / "new.jsonl", records(machine=elsewhere))
    [problem] = perf_budget.rerun_check(config(), old, new)
    assert "not compared across machines" in problem


def test_the_committed_samples_match_the_committed_config() -> None:
    committed = load_config(REPO / "research/configs/perf-budget.json")
    header, _, cells = perf_budget.read_samples(REPO / committed["samples"])
    assert header["suite"] == committed["suite"]
    assert len(cells) > 0
