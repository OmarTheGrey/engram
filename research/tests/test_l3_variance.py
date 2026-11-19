"""Card L3's variance script, proven on cassette replays (plan PR 2, decision 3).

The first tests feed the aggregation planted rows with a known spread. The
end-to-end test runs research/scripts/l3_variance.py on the pipeline config
(research/configs/l3-variance-fixture.json): it replays the scripted lint
model's committed cassettes (fixtures/cassettes/l3-lint-fixture) offline
through packages/runner/scripts/run.ts with zero new calls, and the planted
spread of fixtures/lint/l3-script.json (a missed contradiction at seed 2, a
false one at seed 3, a malformed reply at seed 1, a refusal at seed 3) comes
out as computed here by hand. The numbers are the script's and are not
results; nothing here is written under research/results. The live pilot
(research/configs/l3-variance.json) refuses until its model is named.
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any

import pytest

from scripts import l3_variance
from scripts.results_io import REPO, dumps_result, load_config

FIXTURE_CONFIG = REPO / "research/configs/l3-variance-fixture.json"
PILOT_CONFIG = REPO / "research/configs/l3-variance.json"


def row(
    fixture: str,
    seed: int,
    flags: list[str],
    units: list[tuple[str, str, str]],
    lint: str = "contradiction",
) -> dict[str, Any]:
    """A run row; units are (unit, declared verdict, outcome), and a flag finds its item."""
    return {
        "fixture": fixture,
        "lint_id": lint,
        "kind": "flag" if flags else "near-miss",
        "seed": seed,
        "labels": {"flags": flags, "units": [{"unit": u, "verdict": v} for u, v, _ in units]},
        "judgments": [{"unit": u, "outcome": o} for u, _, o in units],
        "findings": [
            {"lint_id": lint, "item_id": u.split("+")[-1]} for u, _, o in units if o == "flag"
        ],
    }


def test_seed_stats_count_outcomes_and_score_items_against_the_labels() -> None:
    rows = [
        row("f", 1, ["b"], [("a+b", "flag", "flag"), ("a+c", "pass", "flag")]),
        row("n", 1, [], [("x+y", "pass", "malformed"), ("x+z", "pass", "pass")]),
    ]
    stats = l3_variance.seed_stats(rows, "contradiction", 1)
    assert stats == {
        "units": 4,
        "flag": 2,
        "pass": 1,
        "refused": 0,
        "malformed": 1,
        "tp": 1,
        "fp": 1,
        "fn": 0,
        "precision": 0.5,
        "recall": 1.0,
        "flag_rate": 2 / 3,
        "unjudged_rate": 0.25,
        "unit_accuracy": 2 / 3,
    }


def test_a_rate_with_no_denominator_is_null_and_left_out_of_the_spread() -> None:
    rows = [row("n", s, [], [("x+y", "pass", "pass")]) for s in (1, 2)]
    stats = l3_variance.seed_stats(rows, "contradiction", 1)
    assert stats["precision"] is None and stats["recall"] is None
    assert l3_variance.spread([None, 0.5, 1.0]) == {
        "n": 2,
        "mean": 0.75,
        "sd": statistics.stdev([0.5, 1.0]),
        "min": 0.5,
        "max": 1.0,
    }
    assert l3_variance.spread([None]) == {
        "n": 0,
        "mean": None,
        "sd": None,
        "min": None,
        "max": None,
    }
    assert l3_variance.spread([0.3])["sd"] is None


def test_unit_agreement_keys_units_by_fixture_and_needs_every_seed() -> None:
    rows = [
        row("f", 1, [], [("a+b", "pass", "pass"), ("a+c", "pass", "refused")]),
        row("f", 2, [], [("a+b", "pass", "pass"), ("a+c", "pass", "malformed")]),
        # The same unit id in another fixture is another unit; this one lacks seed 2.
        row("g", 1, [], [("a+b", "pass", "flag")]),
    ]
    assert l3_variance.unit_agreement(rows, "contradiction", [1, 2]) == {
        "units": 2,
        "incomplete": 1,
        "same_outcome": 1,
        "same_outcome_share": 0.5,
        "same_flag": 2,
        "same_flag_share": 1.0,
    }


def test_the_script_reports_the_planted_spread_from_a_zero_call_cassette_replay(
    tmp_path: Path,
) -> None:
    out = tmp_path / "l3-variance-fixture.json"
    assert l3_variance.main(["--config", str(FIXTURE_CONFIG), "--out", str(out)]) == 0
    result = json.loads(out.read_text(encoding="utf-8"))
    assert result["calls"] == {"cached": 51, "new": 0}
    assert result["scripted"] is True
    assert result["seeds"] == [1, 2, 3]
    assert [f["name"] for f in result["fixtures"]] == [
        "contradiction.flag",
        "contradiction.near-miss",
        "unsupported-claim.flag",
        "unsupported-claim.near-miss",
    ]

    c = result["lints"]["contradiction"]
    # Seed 1: both contradictions found, one malformed reply on the near-miss.
    # Seed 2: the database contradiction missed. Seed 3: a false flag.
    assert [c["per_seed"][s]["precision"] for s in "123"] == [1.0, 1.0, round(2 / 3, 6)]
    assert [c["per_seed"][s]["recall"] for s in "123"] == [1.0, 0.5, 1.0]
    assert [c["per_seed"][s]["malformed"] for s in "123"] == [1, 0, 0]
    precision = [1.0, 1.0, 2 / 3]
    assert c["across_seeds"]["precision"] == {
        "n": 3,
        "mean": round(statistics.fmean(precision), 6),
        "sd": round(statistics.stdev(precision), 6),
        "min": round(2 / 3, 6),
        "max": 1.0,
    }
    assert c["unit_agreement"] == {
        "units": 12,
        "incomplete": 0,
        "same_outcome": 9,
        "same_outcome_share": 0.75,
        "same_flag": 10,
        "same_flag_share": round(10 / 12, 6),
    }

    u = result["lints"]["unsupported-claim"]
    # Seed 3 refuses the rota claim: one flag fewer, recall two thirds.
    assert [u["per_seed"][s]["refused"] for s in "123"] == [0, 0, 1]
    assert [u["per_seed"][s]["recall"] for s in "123"] == [1.0, 1.0, round(2 / 3, 6)]
    assert u["across_seeds"]["precision"]["sd"] == 0.0
    assert u["unit_agreement"]["same_outcome"] == 4 and u["unit_agreement"]["units"] == 5

    # Byte-stable, and naming no path of this machine.
    again = tmp_path / "again.json"
    l3_variance.main(["--config", str(FIXTURE_CONFIG), "--out", str(again)])
    assert again.read_bytes() == out.read_bytes()
    assert out.read_text(encoding="utf-8") == dumps_result(result)
    assert str(REPO) not in out.read_text(encoding="utf-8")
    assert str(tmp_path) not in out.read_text(encoding="utf-8")


def test_the_live_pilot_refuses_until_its_model_is_named(tmp_path: Path) -> None:
    config = load_config(PILOT_CONFIG)
    assert config["runner_config"] == "research/configs/l3-pilot.json"
    assert config["model"] is None
    with pytest.raises(SystemExit, match="prereg/M1"):
        l3_variance.build(config)
    with pytest.raises(ValueError, match="pipeline config"):
        l3_variance.build({**load_config(FIXTURE_CONFIG), "model": "openrouter/x"})


def test_a_scripted_run_is_never_written_under_research_results() -> None:
    target = REPO / "research/results/zz-l3-probe.json"
    assert not target.exists()
    with pytest.raises(SystemExit, match="scripted"):
        l3_variance.main(["--config", str(FIXTURE_CONFIG), "--out", str(target)])
    assert not target.exists()
    # Another spelling of the same folder is refused too.
    roundabout = str(REPO / "research" / ".." / "research" / "results" / "zz.json")
    with pytest.raises(SystemExit, match="scripted"):
        l3_variance.main(["--config", str(FIXTURE_CONFIG), "--out", roundabout])
    assert not (REPO / "research/results/zz.json").exists()
