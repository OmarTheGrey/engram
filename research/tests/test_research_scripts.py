"""The research scripts of PR 2 (docs/tasks/prereg-v1-plan.md) without their heavy inputs.

`make test-repro` reruns the real scripts on the real data; these tests check
the parts that need neither: the reproduce loop on a toy manifest, the
aggregations on planted rows, the byte-stable writer, the pinned-data checks,
and the power simulation's pieces at a tiny size.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import pytest

from analysis.power import (
    Cell,
    ladder,
    normal_approx_items,
    simulate_items,
    smallest_passing,
    start_rung,
)
from scripts import h1_gatemem_reach, h1_mem_inv_admission, h1_table, h4_power, reproduce
from scripts.results_io import REPO, dumps_result, ensure_pinned_gatemem, line_hashes

# make test-repro (research/scripts/reproduce.py).

TOY_SCRIPT = """\
import argparse, json, pathlib
p = argparse.ArgumentParser()
p.add_argument("--config", required=True)
p.add_argument("--out", required=True)
a = p.parse_args()
n = json.loads(pathlib.Path(a.config).read_text())["n"]
pathlib.Path(a.out).write_text(json.dumps({"square": n * n}) + "\\n", newline="\\n")
"""


def toy_repo(tmp_path: Path, *, n: int, sha: str | None = None) -> Path:
    (tmp_path / "research/scripts").mkdir(parents=True)
    (tmp_path / "research/configs").mkdir(parents=True)
    (tmp_path / "research/results").mkdir(parents=True)
    (tmp_path / "research/scripts/toy.py").write_text(TOY_SCRIPT, encoding="utf-8")
    (tmp_path / "research/configs/toy.json").write_text(json.dumps({"n": n}), encoding="utf-8")
    body = b'{"square": 9}\n'
    (tmp_path / "research/results/h9-toy.json").write_bytes(body)
    digest = sha or hashlib.sha256(body).hexdigest()
    (tmp_path / "research/results/MANIFEST.md").write_text(
        "| file | config | script | commit | sha256 | figure |\n"
        "|---|---|---|---|---|---|\n"
        f"| research/results/h9-toy.json | research/configs/toy.json | research/scripts/toy.py"
        f" | abc1234 | {digest} | none |\n",
        encoding="utf-8",
    )
    return tmp_path


def test_reproduce_passes_when_every_row_regenerates_to_its_hash(tmp_path: Path) -> None:
    assert reproduce.main(["--root", str(toy_repo(tmp_path, n=3))]) == 0


def test_reproduce_fails_when_the_regenerated_bytes_differ(tmp_path: Path) -> None:
    root = toy_repo(tmp_path, n=4)  # squares to 16, not the committed 9
    assert reproduce.main(["--root", str(root)]) == 1


def test_reproduce_fails_when_the_manifest_hash_is_not_the_committed_file(tmp_path: Path) -> None:
    root = toy_repo(tmp_path, n=3, sha="0" * 64)
    problems = reproduce.check_row(
        root,
        reproduce.manifest_rows(
            (root / "research/results/MANIFEST.md").read_text(encoding="utf-8")
        )[0],
    )
    assert any("committed file" in p for p in problems)
    assert any("regenerated" in p for p in problems)


def test_the_repository_manifest_rows_parse() -> None:
    text = (REPO / "research/results/MANIFEST.md").read_text(encoding="utf-8")
    for row in reproduce.manifest_rows(text):
        assert (REPO / row.script).exists() and (REPO / row.config).exists()
        assert len(row.sha256) == 64


# The byte-stable writer and the pinned data.


def test_results_are_byte_stable_sorted_rounded_and_newline_terminated() -> None:
    text = dumps_result({"b": 1 / 3, "a": [-0.0000001, 2.0], "c": {"z": 1, "y": True}})
    assert text == (
        '{\n  "a": [\n    0.0,\n    2.0\n  ],\n  "b": 0.333333,\n'
        '  "c": {\n    "y": true,\n    "z": 1\n  }\n}\n'
    )


def test_pinned_gatemem_data_with_a_wrong_hash_is_refused(tmp_path: Path) -> None:
    manifest = json.loads((REPO / "fixtures/bench/gatemem/manifest.json").read_text("utf-8"))
    data = tmp_path / "data"
    for domain in ("education", "household", "medical", "office"):
        (data / domain).mkdir(parents=True)
        for name in ("episodes.jsonl", "checkpoints.jsonl"):
            (data / domain / name).write_text("not the pinned data\n", encoding="utf-8")
    stub = tmp_path / "manifest.json"
    stub.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="sha256 differs"):
        ensure_pinned_gatemem(data, stub, fetch=False)


def test_missing_gatemem_data_is_not_fetched_offline(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENGRAM_OFFLINE", "1")
    with pytest.raises(RuntimeError, match="ENGRAM_OFFLINE"):
        ensure_pinned_gatemem(
            tmp_path / "none", REPO / "fixtures/bench/gatemem/manifest.json", fetch=True
        )


def test_the_vendored_mem_inv_cases_match_their_manifest(tmp_path: Path) -> None:
    fixtures = REPO / "fixtures/bench/mem-inv-bench"
    assert h1_mem_inv_admission.check_fixture(fixtures) == (
        "cf3c9a4ca9f0478000d6aa26eb268b875232d34b"
    )
    copy = tmp_path / "mib"
    shutil.copytree(fixtures, copy)
    lines = (copy / "cases.jsonl").read_text(encoding="utf-8").split("\n")
    (copy / "cases.jsonl").write_text("\n".join(lines[1:]), encoding="utf-8", newline="\n")
    assert line_hashes(copy / "cases.jsonl") != line_hashes(fixtures / "cases.jsonl")
    with pytest.raises(ValueError, match="line hashes"):
        h1_mem_inv_admission.check_fixture(copy)


# The aggregations, on planted rows.


def reach_row(
    kind: str, domain: str, targets: int, located: int, reachable: int, **extra: object
) -> dict[str, object]:
    return {
        "checkpoint_id": f"{domain}_{kind}_{targets}{located}{reachable}",
        "kind": kind,
        "domain": domain,
        "attack_type": extra.get("attack_type", "planted"),
        "targets": targets,
        "located": located,
        "reachable": reachable,
        "reachable_own": extra.get("own", 0),
        "reachable_granted": extra.get("granted", reachable),
        "context_leak": extra.get("context_leak", reachable > 0),
        "denied_writes": 0,
    }


def test_the_reach_summary_counts_reachable_and_located_checkpoints() -> None:
    rows = [
        reach_row("access", "office", 2, 2, 2),
        reach_row("access", "office", 2, 2, 1),
        reach_row("access", "medical", 3, 3, 0),
        reach_row("access", "medical", 1, 0, 0),
        reach_row("forgetting", "office", 1, 1, 1, own=1, granted=0),
    ]
    summary = h1_gatemem_reach.summarise(rows)
    access = summary["kinds"]["access"]["all"]
    assert access["checkpoints"] == 4
    assert access["reachable"] == 2 and access["share_reachable"] == 0.5
    assert access["every_target_reachable"] == 1
    assert access["located"] == 3 and access["located_unreachable"] == 1
    assert access["targets"] == 8 and access["targets_reachable"] == 3
    assert summary["kinds"]["access"]["domains"]["medical"]["reachable"] == 0
    assert summary["kinds"]["forgetting"]["all"]["reachable_own"] == 1
    assert summary["all"]["checkpoints"] == 5


def test_the_admission_summary_counts_cases_reaching_the_read() -> None:
    def case(preset: str, laundering: str, in_read: bool, status: str | None) -> dict[str, object]:
        entry = {
            "channel": "web",
            "kind": "document",
            "decision": "allow",
            "status": status,
            "in_read": in_read,
        }
        return {
            "preset": preset,
            "family": "legit" if laundering == "legit" else "attack",
            "laundering": laundering,
            "written": status is not None,
            "active": status == "active",
            "in_read": in_read,
            "marked": [entry],
        }

    rows = [
        case("medium", "direct", True, "active"),
        case("strict", "direct", False, "candidate"),
        case("strict", "legit", False, "candidate"),
    ]
    summary = h1_mem_inv_admission.summarise(rows)
    assert summary["medium"]["laundering"]["direct"]["share_admitted"] == 1.0
    strict = summary["strict"]
    assert strict["laundering"]["direct"] == {
        "cases": 1,
        "written": 1,
        "active": 0,
        "admitted": 0,
        "share_written": 1.0,
        "share_active": 0.0,
        "share_admitted": 0.0,
    }
    # Only attacks' entries are counted by channel.
    assert strict["poisoned_entries_by_channel"]["web"]["statuses"] == {"candidate": 1}


# The power simulation (research/analysis/power.py), at a tiny size.


def test_simulated_arms_have_the_rate_and_the_discordance_the_cell_states() -> None:
    cell = Cell(rate=0.2, margin=0.05, kappa=0.5, seed_model="identical")
    values = simulate_items(cell, 200_000, np.random.default_rng(1))
    assert values.shape == (3, 200_000)
    assert float(values.mean()) == pytest.approx(0.2, abs=0.003)
    disagree = float(np.mean(values[0] != values[1]))
    assert disagree == pytest.approx(0.5 * 2 * 0.2 * 0.8, abs=0.003)


def test_independent_seeds_average_three_draws_per_item() -> None:
    cell = Cell(rate=0.5, margin=0.05, kappa=1.0, seed_model="independent")
    values = simulate_items(cell, 1_000, np.random.default_rng(2))
    assert set(np.unique(values)) <= {0.0, 1 / 3, 2 / 3, 1.0}


def test_the_normal_approximation_scales_with_discordance_over_margin_squared() -> None:
    base = Cell(rate=0.1, margin=0.05, kappa=1.0, seed_model="identical")
    n = normal_approx_items(base)
    assert n == pytest.approx(0.18 * (1.6448536 + 1.2815516) ** 2 / 0.0025, rel=1e-6)
    half = Cell(rate=0.1, margin=0.05, kappa=0.5, seed_model="identical")
    assert normal_approx_items(half) == pytest.approx(n / 2)
    three = Cell(rate=0.1, margin=0.05, kappa=1.0, seed_model="independent")
    assert normal_approx_items(three) == pytest.approx(n / 3)


def test_the_ladder_and_its_walk() -> None:
    rungs = ladder(10, 100, 2)
    assert rungs == [10, 14, 20, 28, 40, 57, 80]
    assert start_rung(rungs, 33.0) == 3 and start_rung(rungs, 5.0) == 0
    curve = {10: 0.95, 14: 0.5, 20: 0.6, 28: 0.79, 40: 0.81, 57: 0.9, 80: 0.99}
    # From below it climbs to 40; from above it walks down to 40 and stops at 28,
    # never reaching the small-sample pass at 10.
    assert smallest_passing(rungs, 2, curve.__getitem__, 0.8) == 4
    assert smallest_passing(rungs, 6, curve.__getitem__, 0.8) == 4
    assert smallest_passing(rungs, 0, lambda n: 0.0, 0.8) is None


def test_a_power_cell_reports_both_sizes_and_what_it_evaluated() -> None:
    config = {
        "seed": 7,
        "target_power": 0.8,
        "alpha": 0.05,
        "simulations": 20,
        "resamples": 500,
        "ladder_start": 10,
        "ladder_stop": 5_000,
        "steps_per_doubling": 1,
    }
    cell = Cell(rate=0.2, margin=0.1, kappa=1.0, seed_model="independent")
    result = h4_power.cell_result(cell, config, 0)
    assert result["as_written"]["items"] >= 10
    assert result["nondegenerate"]["items"] >= result["as_written"]["items"]
    assert result["as_written"]["power"] >= 0.8
    assert [p["items"] for p in result["evaluated"]] == sorted(
        p["items"] for p in result["evaluated"]
    )
    assert h4_power.cell_result(cell, config, 0) == result


def test_the_power_grid_spread_over_processes_equals_the_cells_computed_one_by_one() -> None:
    config = {
        "name": "h4-tiny",
        "seed": 9,
        "arms": 3,
        "seeds_per_item": 3,
        "margins": [0.1],
        "rates": [0.1, 0.2],
        "kappas": [1.0],
        "seed_models": ["independent", "identical"],
        "target_power": 0.8,
        "alpha": 0.05,
        "simulations": 10,
        "resamples": 300,
        "ladder_start": 10,
        "ladder_stop": 2_000,
        "steps_per_doubling": 1,
    }
    grid = h4_power.compute(config)["cells"]
    cells = [
        Cell(rate=rate, margin=0.1, kappa=1.0, seed_model=model)
        for rate in (0.1, 0.2)
        for model in ("independent", "identical")
    ]
    assert grid == [h4_power.cell_result(c, config, i) for i, c in enumerate(cells)]


# The H1 table script (research/scripts/h1_table.py), on planted sessions.


def test_the_h1_table_script_is_byte_stable_on_planted_sessions(tmp_path: Path) -> None:
    rng = np.random.default_rng(20261102)
    rows = []
    for benchmark, items in (("gatemem", 200), ("mem-inv-bench", 24)):
        for condition, rate in (("C2", 0.4), ("C3", 0.3), ("C4", 0.25), ("C5", 0.05)):
            draws = rng.random((items, 3)) < rate
            for i in range(items):
                for s in range(3):
                    rows.append(
                        {
                            "benchmark": benchmark,
                            "model": "provider/m1",
                            "store": "fake",
                            "preset": "none" if condition == "C2" else "medium",
                            "condition": condition,
                            "item": f"{benchmark}/{i:03d}",
                            "seed": s + 1,
                            "violation": bool(draws[i, s]),
                        }
                    )
    sessions = tmp_path / "sessions.jsonl"
    sessions.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    config = tmp_path / "h1.json"
    config.write_text(
        json.dumps(
            {
                "name": "h1-planted",
                "sessions": str(sessions),
                "primary_model": "provider/m1",
                "store": "fake",
                "seed": 7,
            }
        ),
        encoding="utf-8",
    )
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    assert h1_table.main(["--config", str(config), "--out", str(first)]) == 0
    assert h1_table.main(["--config", str(config), "--out", str(second)]) == 0
    assert first.read_bytes() == second.read_bytes()
    table = json.loads(first.read_text(encoding="utf-8"))
    assert table["decision"] == {
        "h1": "supported",
        "primary": "supported",
        "secondary": "does not contradict",
    }
