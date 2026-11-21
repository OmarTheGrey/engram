"""Card E2.10: the injection screen's rates, counted from planted rows (no node, no corpus run)."""

from __future__ import annotations

from typing import Any

import pytest

from scripts.injection_screen import summarise

ENTRIES: list[dict[str, Any]] = [
    {"id": "a1", "group": "amsb-attack", "category": "x", "expected": "hold"},
    {"id": "a2", "group": "amsb-attack", "category": "x", "expected": "hold"},
    {"id": "a3", "group": "amsb-attack", "category": "y", "expected": "hold"},
    {"id": "b1", "group": "technical", "expected": "admit"},
    {"id": "b2", "group": "preference-user", "expected": "admit"},
    {"id": "d1", "group": "preference-tool", "expected": "by-design"},
]


def rows(profile: str, held: set[str]) -> list[dict[str, Any]]:
    return [
        {"id": e["id"], "profile": profile, "held": e["id"] in held, "failed_closed": False}
        for e in ENTRIES
    ]


def test_escape_false_hold_and_by_design_are_counted_apart() -> None:
    out = summarise(ENTRIES, rows("default", {"a1", "b2", "d1"}), ["default"], 0.95)["default"]
    assert out["escape"]["count"] == 2 and out["escape"]["n"] == 3
    assert out["escaped"] == ["a2", "a3"]
    assert out["escape_by_category"]["x"]["count"] == 1
    assert out["escape_by_category"]["y"]["count"] == 1
    assert out["false_hold"]["count"] == 1 and out["false_hold"]["n"] == 2
    assert out["false_holds"] == ["b2"]
    assert out["false_hold_by_group"]["preference-user"]["count"] == 1
    assert out["false_hold_by_group"]["technical"]["count"] == 0
    assert out["by_design_hold"] == {
        "n": 1,
        "count": 1,
        "rate": 1.0,
        "wilson": out["by_design_hold"]["wilson"],
    }
    lo, hi = out["false_hold"]["wilson"]
    assert 0.0 < lo < 0.5 < hi < 1.0


def test_the_off_profile_must_hold_nothing() -> None:
    summarise(ENTRIES, rows("off", set()), ["off"], 0.95)
    with pytest.raises(ValueError, match="off profile held a write"):
        summarise(ENTRIES, rows("off", {"b1"}), ["off"], 0.95)


def test_rows_must_cover_the_corpus_once() -> None:
    with pytest.raises(ValueError, match="do not cover the corpus"):
        summarise(ENTRIES, rows("default", set())[:-1], ["default"], 0.95)
