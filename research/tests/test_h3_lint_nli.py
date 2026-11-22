"""Card L7's report of the local NLI tier beside the model tier (arm P3, not registered).

The threshold rule and the renaming of the tier's findings are tested on
planted rows worked out by hand; the end-to-end replay is the committed
result, checked by `make test-repro`, and is run here once against its bytes.
"""

from __future__ import annotations

from typing import Any

import pytest

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


def test_a_pass_scored_1_leaves_no_upper_strictly_above_it_and_is_refused() -> None:
    # Review L7-8: the upper stays strictly above every pass; at a pass of 1.0 no
    # upper of at most 1 is, so the rule refuses rather than flag that pass.
    with pytest.raises(ValueError, match="strictly above"):
        h3_lint_nli.derive_thresholds(
            [row("x", [("a", "pass", 1.0, 0.2), ("b", "flag", 0.99, 0.99)])], RULE
        )


def scored(unit: str, item: str, forward: float, backward: float) -> dict[str, Any]:
    return {
        "unit": unit,
        "item_id": item,
        "forward": {"contradiction": forward},
        "backward": {"contradiction": backward},
        "contradiction": max(forward, backward),
    }


def test_score_counts_at_each_cut_both_directions_and_forward_only() -> None:
    # Review L7-2: two seeds of the same question count each pair once.
    pairs = [
        scored("u1", "i1", 0.95, 0.2),
        scored("u2", "i2", 0.3, 0.999),
        scored("u3", "i3", 0.6, 0.4),
        scored("u4", "i1", 0.9999, 0.9999),
    ]
    rows = [{"question_id": "q", "seed": s, "nli": pairs} for s in (1, 2)]
    got = h3_lint_nli.score_counts(rows)
    assert got["pairs"] == 4
    assert got["both_directions"] == {"0.5": 4, "0.9": 3, "0.99": 2, "0.999": 2}
    assert got["forward_only"] == {"0.5": 3, "0.9": 2, "0.99": 1, "0.999": 1}


def test_forward_only_flags_split_into_faults_other_labels_and_unlabelled_items() -> None:
    pairs = [
        scored("u1", "fault", 0.95, 0.2),
        scored("u2", "near", 0.91, 0.1),
        scored("u3", "plain", 0.99, 0.1),
        scored("u4", "plain", 0.92, 0.1),
        scored("u5", "low", 0.2, 0.99),
    ]
    rows = [{"question_id": "q", "seed": 1, "nli": pairs}]
    labels = {
        "q": [
            {"finding_on": "fault", "kind": "fault"},
            {"finding_on": "near", "kind": "near-miss"},
        ]
    }
    got = h3_lint_nli.forward_flags(rows, labels, 0.9)
    assert got["pairs"] == 4
    assert got["items"] == 3
    assert got["fault_items"] == 1
    assert got["near_miss_items"] == 1
    assert got["unlabelled"] == [{"question_id": "q", "item_id": "plain", "pairs": 2}]


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
    assert built["decides"] is False
    committed = (REPO / "research" / "results" / "h3-lint-nli.json").read_text(encoding="utf-8")
    assert dumps_result(built) == committed
