"""Card L7's report of the local NLI tier beside the model tier (arm P3, not registered).

The threshold rule and the renaming of the tier's findings are tested on
planted rows worked out by hand; the end-to-end replay is the committed
result, checked by `make test-repro`, and is run here once against its bytes.
"""

from __future__ import annotations

from typing import Any

from scripts import h3_lint_nli
from scripts.results_io import REPO, dumps_result, load_config

RULE = {"grid": 0.01, "upper_at_least": 0.9, "lower_at_most": 0.1}


def row(fixture: str, units: list[tuple[str, str, float, float]]) -> dict[str, Any]:
    return {
        "fixture": fixture,
        "seed": 1,
        "labels": {"units": [{"unit": u, "verdict": v} for u, v, _, _ in units]},
        "nli": [
            {
                "unit": u,
                "forward": {"contradiction": f},
                "backward": {"contradiction": b},
                "contradiction": max(f, b),
            }
            for u, _, f, b in units
        ],
    }


def test_the_upper_is_the_first_step_above_every_pass_and_at_least_its_floor() -> None:
    got = h3_lint_nli.derive_thresholds(
        [row("x", [("a", "pass", 0.5, 0.2), ("b", "flag", 0.97, 0.99)])], RULE
    )
    assert (got["upper"], got["lower"]) == (0.9, 0.1)
    got = h3_lint_nli.derive_thresholds(
        [row("x", [("a", "pass", 0.5, 0.9961), ("b", "flag", 0.97, 0.99)])], RULE
    )
    assert got["upper"] == 1.0


def test_the_lower_is_the_last_step_at_or_below_every_flag_and_at_most_its_ceiling() -> None:
    got = h3_lint_nli.derive_thresholds(
        [row("x", [("a", "pass", 0.01, 0.02), ("b", "flag", 0.057, 0.03)])], RULE
    )
    assert got["lower"] == 0.05


def test_a_unit_seen_at_several_seeds_counts_once() -> None:
    r = row("x", [("a", "pass", 0.1, 0.1)])
    got = h3_lint_nli.derive_thresholds(
        [r, {**r, "seed": 2}, row("x", [("b", "flag", 0.99, 0.99)])], RULE
    )
    assert [u["unit"] for u in got["units"]] == ["a", "b"]


def test_the_tier_s_flags_are_scored_as_the_contradiction_lint_s() -> None:
    findings = [
        {"tier": "model", "lint_id": "contradiction-nli", "item_id": "i", "base": False},
        {"tier": "model", "lint_id": "contradiction", "item_id": "j", "base": False},
        {"tier": "deterministic", "lint_id": "duplicate", "item_id": "k", "base": False},
    ]
    assert [(f["lint_id"], f["item_id"]) for f in h3_lint_nli.renamed(findings, True)] == [
        ("contradiction", "i"),
        ("contradiction", "j"),
    ]
    assert [f["item_id"] for f in h3_lint_nli.renamed(findings, False)] == ["i"]


def test_the_committed_result_replays_byte_for_byte() -> None:
    config = load_config(REPO / "research" / "configs" / "h3-lint-nli.json")
    built = h3_lint_nli.build(config)
    assert built["registered"] is False
    committed = (REPO / "research" / "results" / "h3-lint-nli.json").read_text(encoding="utf-8")
    assert dumps_result(built) == committed
