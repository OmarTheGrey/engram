"""Card D5: the procedure safety scan's rates, counted from planted rows (no node, no corpus)."""

from __future__ import annotations

from typing import Any

import pytest

from scripts.procedure_scan import summarise

HELD = "engram/promote/safety-scan"

CASES: list[dict[str, Any]] = [
    {"id": "u1", "expected": "hold", "group": "unsafe", "class": "shell-injection"},
    {"id": "u2", "expected": "hold", "group": "unsafe", "class": "shell-injection"},
    {"id": "u3", "expected": "hold", "group": "unsafe", "class": "exfiltration"},
    {"id": "n1", "expected": "admit", "group": "near-miss", "class": "exfiltration"},
    {"id": "h1", "expected": "admit", "group": "hard-negative", "class": "destructive"},
]


def rows(mode: str, held: set[str]) -> list[dict[str, Any]]:
    return [
        {
            "id": c["id"],
            "mode": mode,
            "held": c["id"] in held,
            "policy_id": HELD if c["id"] in held else "p/promotion/procedural",
        }
        for c in CASES
    ]


def test_hold_and_false_hold_are_counted_per_class_and_group() -> None:
    out = summarise(CASES, rows("hold", {"u1", "u3", "h1"}), ["hold"], 0.95)["hold"]
    assert out["hold"]["count"] == 2 and out["hold"]["n"] == 3
    assert out["missed"] == ["u2"]
    assert out["hold_by_class"]["shell-injection"]["count"] == 1
    assert out["hold_by_class"]["exfiltration"]["rate"] == 1.0
    assert out["false_hold"]["count"] == 1 and out["false_hold"]["n"] == 2
    assert out["false_holds"] == ["h1"]
    assert out["false_hold_by_group"]["near-miss"]["count"] == 0
    assert out["decided_by"] == {"engram/promote/safety-scan": 3, "p/promotion/procedural": 2}
    lo, hi = out["hold"]["wilson"]
    assert 0.0 < lo < 2 / 3 < hi <= 1.0


@pytest.mark.parametrize("mode", ["off", "report"])
def test_off_and_report_must_hold_nothing(mode: str) -> None:
    summarise(CASES, rows(mode, set()), [mode], 0.95)
    with pytest.raises(ValueError, match=f"the {mode} mode held a case"):
        summarise(CASES, rows(mode, {"u1"}), [mode], 0.95)


def test_rows_must_cover_the_corpus_once() -> None:
    with pytest.raises(ValueError, match="do not cover the corpus"):
        summarise(CASES, rows("hold", set())[:-1], ["hold"], 0.95)
