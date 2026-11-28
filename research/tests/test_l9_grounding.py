"""Card L9's proof of concept: the report's counts and checks on planted rows worked out by hand.

The end-to-end replay is the committed result, checked by `make test-repro`.
"""

from __future__ import annotations

from typing import Any

import pytest

from scripts import l9_grounding


def row(outcomes: list[tuple[str, str, str]], seed: int = 1, quotes: int = 2) -> dict[str, Any]:
    """A contradiction row of (unit, label, outcome) units; a flag is a finding with quotes."""
    return {
        "fixture": "contradiction.flag",
        "lint_id": "contradiction",
        "seed": seed,
        "labels": {"units": [{"unit": u, "verdict": lab} for u, lab, _ in outcomes]},
        "judgments": [
            {
                "unit": u,
                "outcome": o,
                **(
                    {
                        "grounding": [
                            {
                                "field": "quote_b",
                                "quote": "invented words",
                                "found": False,
                                "reason": "the quote is not in the item",
                            }
                        ]
                    }
                    if o == "ungrounded"
                    else {}
                ),
            }
            for u, _, o in outcomes
        ],
        "findings": [
            {
                "lint_id": "contradiction",
                "evidence": ["contradicts x"] + ['quote of x: "q"'] * quotes,
            }
            for _, _, o in outcomes
            if o == "flag"
        ],
    }


def test_a_cell_counts_flags_findings_and_ungrounded_and_scores_the_findings() -> None:
    got = l9_grounding.cell(
        [
            ("flag", "flag"),
            ("flag", "ungrounded"),
            ("pass", "flag"),
            ("pass", "pass"),
            ("flag", "malformed"),
        ]
    )
    assert got == {
        "units": 5,
        "labelled_flag": 3,
        "model_flags": 3,
        "findings": 2,
        "ungrounded": 1,
        "true_findings": 1,
        "false_findings": 1,
        "precision": 0.5,
        "recall": 1 / 3,
    }
    assert l9_grounding.cell([("pass", "pass")])["precision"] is None


def test_the_checks_pass_when_the_verdicts_agree_and_fail_otherwise() -> None:
    plain = [row([("a", "flag", "flag"), ("b", "pass", "flag")], quotes=0)]
    grounded = [row([("a", "flag", "flag"), ("b", "pass", "ungrounded")])]
    assert l9_grounding.checks(plain, grounded) == {
        "same_verdicts": 2,
        "grounded_findings_quoted": 1,
    }
    with pytest.raises(ValueError, match="verdicts differ"):
        l9_grounding.checks(plain, [row([("a", "flag", "pass"), ("b", "pass", "ungrounded")])])
    with pytest.raises(ValueError, match="carries 1 quotes"):
        l9_grounding.checks(plain, [row([("a", "flag", "flag"), ("b", "pass", "flag")], quotes=1)])
    with pytest.raises(ValueError, match="plain finding carries a quote"):
        l9_grounding.checks([row([("a", "flag", "flag"), ("b", "pass", "flag")])], grounded)


def test_downgraded_lists_each_ungrounded_flag_with_its_label_and_reason() -> None:
    got = l9_grounding.downgraded(
        [row([("a", "flag", "flag"), ("b", "pass", "ungrounded")], seed=3)]
    )
    assert got == [
        {
            "fixture": "contradiction.flag",
            "seed": 3,
            "unit": "b",
            "label": "pass",
            "failed": [
                {
                    "field": "quote_b",
                    "quote": "invented words",
                    "reason": "the quote is not in the item",
                }
            ],
        }
    ]
