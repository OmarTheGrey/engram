"""Candidate frontier axes (card RV8, RV-DES-2): the variants, the entry point and the summaries.

The entry point (packages/runner/scripts/frontier-axes.ts) runs here on the
committed fixture subsets of GateMem and LongMemEval, with no model: it must
validate every configured variant through core's loader and refuse a bad
path, and the axes must move what the plane admits in the direction each one
names (no grants hides granted turns on GateMem; a short ttl and a small
budget hide turns on LongMemEval; grants do nothing there, where nothing is
granted). The summaries are checked on planted rows.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import frontier_axes as fa
from scripts.results_io import REPO, load_config

CONFIG = load_config(REPO / "research/configs/frontier-axes.json")


# The fixture's oracle histories are short: this budget is smaller than any configured.
BUDGET_2 = {
    "name": "budget-2",
    "base": "medium",
    "set": [
        {"path": ["retention", {"scope": "person", "class": "episodic"}, "budget"], "value": 2}
    ],
}


def variants_file(tmp_path: Path, names: list[str]) -> Path:
    specs = [s for s in fa.variant_specs(CONFIG) if s["name"] in names] + [BUDGET_2]
    path = tmp_path / "variants.json"
    path.write_text(json.dumps(specs), encoding="utf-8")
    return path


def test_every_configured_variant_is_a_policy_core_accepts(tmp_path: Path) -> None:
    data = tmp_path / "q.jsonl"
    first = (REPO / "fixtures/bench/longmemeval/questions.jsonl").read_text(encoding="utf-8")
    data.write_text(first.splitlines()[0] + "\n", encoding="utf-8")
    path = tmp_path / "all.json"
    path.write_text(json.dumps(fa.variant_specs(CONFIG)), encoding="utf-8")
    rows = fa._run_parts(
        "longmemeval", [data], path, ["--real-time", "2026-11-19T00:00:00.000Z"], tmp_path
    )
    assert sorted(rows[0]["presets"]) == sorted(v["name"] for v in CONFIG["variants"])


def test_a_variant_with_a_bad_path_or_value_is_refused(tmp_path: Path) -> None:
    data = REPO / "fixtures/bench/longmemeval/questions.jsonl"
    for bad in (
        {"name": "x", "base": "medium", "set": [{"path": ["read", "no_such_field"], "value": 1}]},
        {
            "name": "x",
            "base": "medium",
            "set": [{"path": ["retention", {"scope": "nobody"}, "ttl"], "value": 1}],
        },
        {
            "name": "x",
            "base": "medium",
            "set": [{"path": ["read", "honour_grants"], "value": "yes"}],
        },
    ):
        path = tmp_path / "bad.json"
        path.write_text(json.dumps([bad]), encoding="utf-8")
        run = subprocess.run(
            [
                "node",
                fa.ENTRY,
                "--benchmark",
                "longmemeval",
                "--data",
                str(data),
                "--variants",
                str(path),
                "--real-time",
                "2026-11-19T00:00:00.000Z",
                "--out",
                str(tmp_path / "o.jsonl"),
            ],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=False,
        )
        assert run.returncode != 0, bad


def test_the_axes_move_what_the_plane_admits_on_the_fixtures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENGRAM_RESEARCH_WORKERS", "2")
    variants = variants_file(tmp_path, ["medium", "grants-off", "ttl-1d"])
    names = ["medium", "grants-off", "ttl-1d", "budget-2"]
    g = fa.gatemem_rows(REPO / "fixtures/bench/gatemem", variants, tmp_path)
    assert len(g) == 20
    gs = fa.summarise_gatemem(g, names, "medium")
    assert gs["medium"]["identical_to_baseline"] is True
    assert gs["grants-off"]["hidden_vs_baseline"] > 0 and gs["grants-off"]["shown_vs_baseline"] == 0
    assert sum(k["readable_via_grant"] for k in gs["grants-off"]["kinds"].values()) == 0
    data = tmp_path / "lme.json"
    lines = (
        (REPO / "fixtures/bench/longmemeval/questions.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
    )
    data.write_text(json.dumps([json.loads(x) for x in lines if x]), encoding="utf-8")
    rows = fa.longmemeval_rows(data, variants, "2026-11-19T00:00:00.000Z", tmp_path)
    ls = fa.summarise_longmemeval(rows, names, "medium", "read_time")
    assert ls["grants-off"]["identical_to_baseline"] is True
    assert ls["ttl-1d"]["by_cause"]["expired"] > 0
    assert ls["budget-2"]["by_cause"]["not_active"] > 0
    # The bytes do not depend on the worker count.
    monkeypatch.setenv("ENGRAM_RESEARCH_WORKERS", "1")
    again = fa.gatemem_rows(REPO / "fixtures/bench/gatemem", variants, tmp_path / "w1")
    assert fa._rows_sha(again) == fa._rows_sha(g)


def gm_row(query_type: str, cells: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "checkpoint_id": f"c-{query_type}",
        "domain": "office",
        "query_type": query_type,
        "variants": cells,
    }


def test_the_gatemem_summary_counts_against_the_baseline() -> None:
    base = {
        "denied_writes": 0,
        "readable": "1101",
        "readable_own": 1,
        "readable_granted": 2,
        "context_leak": True,
        "scored_reachable": 1,
    }
    tight = {
        "denied_writes": 1,
        "readable": "1000",
        "readable_own": 1,
        "readable_granted": 0,
        "context_leak": False,
        "scored_reachable": 0,
    }
    loose = {
        "denied_writes": 0,
        "readable": "1111",
        "readable_own": 1,
        "readable_granted": 3,
        "context_leak": True,
        "scored_reachable": 1,
    }
    util = {
        "denied_writes": 0,
        "readable": "11",
        "readable_own": 1,
        "readable_granted": 1,
        "include_patterns": 2,
        "include_reachable": 2,
    }
    util_t = {**util, "readable": "10", "readable_granted": 0, "include_reachable": 1}
    rows = [
        gm_row("privacy", {"b": base, "t": tight, "l": loose}),
        gm_row("utility", {"b": util, "t": util_t, "l": util}),
    ]
    s = fa.summarise_gatemem(rows, ["b", "t", "l"], "b")
    t = s["t"]["kinds"]
    assert (t["access"]["hidden_vs_baseline"], t["access"]["shown_vs_baseline"]) == (2, 0)
    assert t["access"]["denied_writes"] == 1 and t["access"]["leak_removed_vs_baseline"] == 1
    assert (
        t["utility"]["losing_include_vs_baseline"] == 1
        and t["utility"]["with_every_include_in_reach"] == 0
    )
    assert (
        s["l"]["kinds"]["access"]["shown_vs_baseline"] == 1
        and s["l"]["kinds"]["access"]["leak_added_vs_baseline"] == 0
    )
    assert s["b"]["identical_to_baseline"] and not s["t"]["identical_to_baseline"]
    assert s["t"]["checkpoints_changed"] == 2


def test_an_axis_is_flat_only_when_every_value_equals_the_baseline() -> None:
    config = {
        "axes": {"baseline": "b", "x": "moves", "y": "flat"},
        "variants": [
            {"name": "b", "axis": "baseline", "value": 0},
            {"name": "x1", "axis": "x", "value": 1},
            {"name": "x2", "axis": "x", "value": 2},
            {"name": "y1", "axis": "y", "value": 1},
        ],
    }
    summaries = {
        "gatemem": {
            "b": {"identical_to_baseline": True},
            "x1": {"identical_to_baseline": True},
            "x2": {"identical_to_baseline": False},
            "y1": {"identical_to_baseline": True},
        },
    }
    v = fa.axes_verdict(config, summaries)
    assert v["x"]["gatemem"] == {"flat": False, "values_that_move": ["x2"]}
    assert v["y"]["gatemem"] == {"flat": True, "values_that_move": []}
    assert "baseline" not in v


def test_the_config_holds_the_four_asked_axes_and_the_baseline() -> None:
    axes = {v["axis"] for v in CONFIG["variants"]}
    assert {"grants", "scope_width", "budget", "ttl", "baseline"} <= axes
    assert len([v for v in CONFIG["variants"] if v["axis"] == "ttl"]) >= 3
    assert CONFIG["baseline"] == "medium"


def lme_cell(hidden: int, real_hidden: int) -> dict[str, Any]:
    def clock(h: int) -> dict[str, Any]:
        return {
            "hidden": h,
            "expired": h,
            "outside_validity": 0,
            "not_active": 0,
            "evidence_turns_hidden": 0,
            "evidence_session_turns_hidden": 0,
        }

    return {
        "writes": {"allow": 5},
        "clocks": {"read_time": clock(hidden), "real_time": clock(real_hidden)},
    }


def test_longmemeval_compares_at_the_configured_clock_only() -> None:
    row = {
        "question_id": "q",
        "evidence_turns": 1,
        "presets": {"b": lme_cell(0, 5), "other_clock": lme_cell(0, 0), "moves": lme_cell(2, 5)},
    }
    s = fa.summarise_longmemeval([row], ["b", "other_clock", "moves"], "b", "read_time")
    assert s["other_clock"]["identical_to_baseline"] is True
    assert s["other_clock"]["questions_changed"] == 0
    assert s["moves"]["identical_to_baseline"] is False
    assert s["moves"]["questions_changed"] == 1 and s["moves"]["hidden_vs_baseline"] == 2
