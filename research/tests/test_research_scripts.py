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
from typing import Any

import numpy as np
import pytest

from analysis.power import (
    SEED_MODELS,
    Cell,
    choose_rung,
    joint_threshold,
    ladder,
    level_gate,
    normal_approx_items,
    simulate_arms,
    simulate_items,
    simulated_level,
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
    """A planted row; the scored set is the targets plus `extra` patterns found as given."""
    plus = int(extra.get("extra", 0))  # type: ignore[call-overload]
    plus_reachable = int(extra.get("extra_reachable", 0))  # type: ignore[call-overload]
    scored_reachable = reachable + plus_reachable
    return {
        "checkpoint_id": f"{domain}_{kind}_{targets}{located}{reachable}{plus}",
        "kind": kind,
        "domain": domain,
        "attack_type": extra.get("attack_type", "planted"),
        "targets": targets,
        "located": located,
        "reachable": reachable,
        "reachable_own": extra.get("own", 0),
        "reachable_granted": extra.get("granted", reachable),
        "scored_patterns": targets + plus,
        "scored_located": located + plus_reachable,
        "scored_reachable": scored_reachable,
        "scored_reachable_own": extra.get("own", 0),
        "scored_reachable_granted": extra.get("granted", scored_reachable),
        "extra_patterns": plus,
        "context_leak": scored_reachable > 0,
        "refusal_leaks": extra.get("refusal_leaks", 0),
        "denied_writes": 0,
        "hits": [
            {"pattern": f"p{i}", "set": "target", "turn_id": f"t{i}", "via": "grant", "text": "x"}
            for i in range(scored_reachable)
        ],
    }


PLANTED = [
    reach_row("access", "office", 2, 2, 2),
    reach_row("access", "office", 2, 2, 1),
    reach_row("access", "medical", 3, 3, 0, extra=1, extra_reachable=1, refusal_leaks=2),
    reach_row("access", "medical", 1, 0, 0),
    reach_row("forgetting", "office", 1, 1, 1, own=1, granted=0),
]


def test_the_reach_summary_puts_every_checkpoint_in_exactly_one_group() -> None:
    summary = h1_gatemem_reach.summarise(PLANTED)
    access = summary["kinds"]["access"]["all"]
    assert access["checkpoints"] == 4
    targets, scored = access["targets"], access["scored"]
    assert (targets["reachable"], targets["located_unreachable"], targets["not_located"]) == (
        2,
        1,
        1,
    )
    assert targets["share_reachable"] == 0.5 and targets["share_not_located"] == 0.25
    for group in (targets, scored):
        assert (
            group["share_reachable"]
            + group["share_located_unreachable"]
            + group["share_not_located"]
        ) == 1.0
    assert targets["every_pattern_reachable"] == 1
    assert targets["patterns"] == 8 and targets["patterns_reachable"] == 3
    # The not_include pattern in reach moves the third checkpoint into the reachable group.
    assert (scored["reachable"], scored["located_unreachable"]) == (3, 0)
    assert access["with_extra_patterns"] == 1 and access["refusal_leak"] == 1
    assert access["context_leak"] == 3
    assert summary["kinds"]["access"]["domains"]["medical"]["targets"]["reachable"] == 0
    assert summary["kinds"]["forgetting"]["all"]["targets"]["reachable_own"] == 1
    assert summary["all"]["checkpoints"] == 5


def test_the_audit_sample_is_seeded_and_drawn_per_kind() -> None:
    first = h1_gatemem_reach.audit_sample(PLANTED, per_kind=2, seed=5)
    assert first == h1_gatemem_reach.audit_sample(PLANTED, per_kind=2, seed=5)
    assert [h["kind"] for h in first] == ["access", "access", "forgetting"]
    assert all(set(h) >= {"checkpoint_id", "pattern", "turn_id", "via", "text"} for h in first)


def test_the_admission_summary_counts_cases_reaching_the_read() -> None:
    def case(preset: str, laundering: str, in_read: bool, status: str | None) -> dict[str, object]:
        entry = {
            "channel": "web",
            "kind": "document",
            "scope": "team:operations",
            "decision": "allow",
            "status": status,
            "in_read": in_read,
        }
        filler = {**entry, "channel": "erp", "kind": "tool", "in_read": status == "active"}
        return {
            "preset": preset,
            "family": "legit" if laundering == "legit" else "attack",
            "laundering": laundering,
            "written": status is not None,
            "active": status == "active",
            "in_read": in_read,
            "marked": [entry],
            "unmarked": [] if laundering == "legit" else [filler],
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
    assert strict["attack_filler"]["statuses"] == {"candidate": 1}
    assert strict["entries_by_scope"]["team:operations"]["admitted"] == 0
    assert strict["entries_by_scope"]["team:operations"]["entries"] == 3


# The power simulation (research/analysis/power.py), at a tiny size.


def test_simulated_arms_have_the_rate_and_the_discordance_the_cell_states() -> None:
    cell = Cell(rate=0.2, margin=0.05, kappa=0.5, seed_model="identical")
    values = simulate_items(cell, 200_000, np.random.default_rng(1))
    assert values.shape == (3, 200_000)
    assert float(values.mean()) == pytest.approx(0.2, abs=0.003)
    disagree = float(np.mean(values[0] != values[1]))
    assert disagree == pytest.approx(0.5 * 2 * 0.2 * 0.8, abs=0.003)


def test_arms_on_the_margin_with_kappa_0_disagree_on_exactly_the_margin_one_way() -> None:
    values = simulate_arms([0.1, 0.15], 0.0, "identical", 3, 200_000, np.random.default_rng(3))
    assert float(values[1].mean() - values[0].mean()) == pytest.approx(0.05, abs=0.003)
    assert float(np.mean(values[0] > values[1])) == 0.0
    assert float(np.mean(values[0] != values[1])) == pytest.approx(0.05, abs=0.003)


def test_independent_seeds_average_three_draws_per_item() -> None:
    cell = Cell(rate=0.5, margin=0.05, kappa=1.0, seed_model="independent")
    values = simulate_items(cell, 1_000, np.random.default_rng(2))
    assert set(np.unique(values)) <= {0.0, 1 / 3, 2 / 3, 1.0}


def test_the_normal_approximation_uses_the_tost_s_floored_score_variance() -> None:
    """Each side at alpha / 2; the variance about the margin is var + m^2, floored at m(1 - m)."""
    z = 1.9599640 + 1.2815516
    base = Cell(rate=0.1, margin=0.05, kappa=1.0, seed_model="identical")
    assert normal_approx_items(base) == pytest.approx((0.18 + 0.0025) * z**2 / 0.0025, rel=1e-6)
    sparse = Cell(rate=0.02, margin=0.05, kappa=0.25, seed_model="independent")
    # 0.25 * 2 * 0.02 * 0.98 / 3 + 0.0025 is below the floor 0.05 * 0.95.
    assert normal_approx_items(sparse) == pytest.approx(0.0475 * z**2 / 0.0025, rel=1e-6)
    assert normal_approx_items(base, joint=True) > normal_approx_items(base)
    assert normal_approx_items(base, alpha=0.01) > normal_approx_items(base)


def test_the_joint_threshold_exceeds_one_pair_and_rises_with_the_target() -> None:
    """All three pairs inside need a wider standardised band than one pair (1.28 at 0.8)."""
    one, two = joint_threshold(0.8), joint_threshold(0.8**0.5)
    assert 1.2816 < one < two
    assert joint_threshold(0.8) == one  # seeded


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


def test_the_rung_choice_climbs_past_a_failed_level_and_never_walks_back_below_it() -> None:
    """Power holds from rung 2; the level fails at rungs 2 and 3. The choice is 4, and it ends."""
    calls: list[int] = []

    def size_ok(r: int) -> bool:
        calls.append(r)
        if len(calls) > 20:
            raise AssertionError("the rung choice is looping")
        return r >= 4

    assert choose_rung(7, 2, lambda r: r >= 2, size_ok) == 4
    assert calls == [2, 3, 4]


def test_the_rung_choice_confirms_down_and_up() -> None:
    always = lambda r: True  # noqa: E731
    assert choose_rung(7, 5, lambda r: r >= 3, always) == 3  # walks down while the rung below holds
    assert choose_rung(7, 1, lambda r: r >= 3, always) == 3  # climbs while the power falls short
    assert choose_rung(4, 1, lambda r: False, always) is None  # never reaches the target
    seen: list[int] = []

    def never(r: int) -> bool:
        seen.append(r)
        if len(seen) > 50:
            raise AssertionError("the rung choice is looping")
        return False

    assert choose_rung(7, 2, lambda r: r >= 2, never) is None  # never holds the level


TINY = {
    "name": "h4-tiny",
    "seed": 7,
    "arms": 3,
    "seeds_per_item": 3,
    "margins": [0.1],
    "rates": [0.2, 0.1],
    "kappas": [1.0],
    "seed_models": ["identical"],
    "families": [1, 4],
    "alphas": [0.05],
    "level_kappas": [0.05],
    "target_power": 0.8,
    "simulations_walk": 100,
    "simulations_confirm": 200,
    "simulations_level": 1000,
    "ladder_start": 10,
    "ladder_stop": 20_000,
    "steps_per_doubling": 2,
}


def check_target(t: dict[str, Any], alpha: float, runs: int) -> None:
    """A reported size: its power reaches the target, its level holds, the rung below fails one."""
    assert t["power"] >= t["target_power"]
    level = t["level"]
    assert level["holds"]
    assert max(level["exact_kappa_0"].values()) <= alpha
    assert level["simulated_max"] + 2 * (alpha * (1 - alpha) / runs) ** 0.5 <= alpha
    below, below_level = t["power_one_rung_below"], t["level_one_rung_below"]
    assert below is None or below < t["target_power"] or not below_level["holds"]


def test_a_power_cell_reports_per_family_a_confirmed_size_whose_level_holds() -> None:
    cell = Cell(rate=0.2, margin=0.1, kappa=1.0, seed_model="identical")
    result = h4_power.cell_result(cell, TINY, 0)
    assert result["level_kappas"] == [0.05, 1.0]
    one, four = (result["alphas"]["0.05"]["targets"][f] for f in ("1", "4"))
    assert four["target_power"] == pytest.approx(0.8**0.25)
    assert one["items"] <= four["items"]
    for t in (one, four):
        check_target(t, 0.05, 1000)
    assert h4_power.cell_result(cell, TINY, 0) == result


def test_at_alpha_0_01_the_size_is_at_least_the_size_at_0_05_and_its_level_holds() -> None:
    config = {
        **TINY,
        "alphas": [0.05, 0.01],
        "families": [1],
        "level_kappas": [],
        "simulations_level": 4000,
    }
    cell = Cell(rate=0.2, margin=0.1, kappa=1.0, seed_model="identical")
    result = h4_power.cell_result(cell, config, 0)["alphas"]
    strict, loose = result["0.01"]["targets"]["1"], result["0.05"]["targets"]["1"]
    assert strict["items"] >= loose["items"]
    check_target(strict, 0.01, 4000)


def test_the_level_gate_needs_both_its_exact_and_its_simulated_half() -> None:
    assert level_gate([0.04, 0.03], [0.02], alpha=0.05, runs=4000)
    assert not level_gate([0.06, 0.03], [0.02], alpha=0.05, runs=4000)  # kappa 0, exact
    assert not level_gate([0.04, 0.03], [0.045], alpha=0.05, runs=4000)  # 0.045 + 0.0069 > 0.05


def test_a_size_whose_exact_kappa_0_level_fails_is_not_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the exact level at kappa 0 fails at every size, the script reports none."""
    monkeypatch.setattr(h4_power, "exact_level", lambda *a, **k: 1.0)
    cell = Cell(rate=0.2, margin=0.1, kappa=1.0, seed_model="identical")
    config = {**TINY, "families": [1], "ladder_stop": 400}
    result = h4_power.cell_result(cell, config, 0)
    assert result["alphas"]["0.05"]["targets"]["1"]["items"] is None


def test_the_power_grid_spread_over_processes_equals_the_cells_computed_one_by_one() -> None:
    grid = h4_power.compute(TINY)["cells"]
    cells = [Cell(rate=r, margin=0.1, kappa=1.0, seed_model="identical") for r in (0.2, 0.1)]
    assert grid == [h4_power.cell_result(c, TINY, i) for i, c in enumerate(cells)]


def test_a_reported_size_holds_the_level_on_an_independent_rerun() -> None:
    """The level at a cell's reported size, rerun with seeds the script did not use."""
    cell = Cell(rate=0.02, margin=0.1, kappa=0.25, seed_model="identical")
    items = h4_power.cell_result(cell, TINY, 3)["alphas"]["0.05"]["targets"]["1"]["items"]
    for kappa in (0.02, 0.1):
        for model in SEED_MODELS:
            level = simulated_level(0.02, 0.1, items, kappa, model, runs=2000, seed=987)
            assert level <= 0.05


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
