"""Tests for research/scripts/quint_trace_replay.py (card E1.8): the result built from a report."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.quint_trace_replay import build

REPO = Path(__file__).resolve().parents[2]
CONFIG = json.loads((REPO / "research" / "configs" / "quint-trace-replay.json").read_text())


def report(*, traces: int = 200, unexplained: int = 0, scenario: str = "E18-F1") -> dict[str, Any]:
    return {
        "traces_sha256": "0" * 64,
        "totals": {"traces": traces, "diverged_by_finding": {"unexplained": unexplained}},
        "findings": {},
        "traces": {},
        "scenarios": {"e18RetractionWhileErasingTest.itf.json.gz": {"finding": scenario}},
    }


def test_the_result_echoes_the_generation_and_keeps_the_report() -> None:
    result = build(CONFIG, report())
    assert result["status"] == "proof of concept"
    assert result["hypothesis"] == "none"
    assert result["generation"]["seed"] == 1
    assert result["totals"]["traces"] == 200


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"traces": 199}, "fewer than 200"),
        ({"unexplained": 1}, "no finding to explain"),
        ({"scenario": "unexplained"}, "no finding to explain"),
    ],
)
def test_build_refuses(changes: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        build(CONFIG, report(**changes))


def test_the_committed_result_has_no_unexplained_divergence() -> None:
    result = json.loads((REPO / "research" / "results" / "h1-quint-trace-replay.json").read_text())
    assert result["totals"]["diverged_by_finding"]["unexplained"] == 0
    assert result["totals"]["traces"] >= CONFIG["min_traces"]
    assert all(s.get("finding") != "unexplained" for s in result["scenarios"].values())
