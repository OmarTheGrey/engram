"""Card E9.15's proof of concept (research/scripts/audit_report.py) on planted records.

`make test-repro` runs the core suite for real; these tests check the
counting alone: a case matches when its verdict and failed check are the
expected ones, a tampering counts as detected only when FAILED, and a
tampering case the record lacks is an error.
"""

from __future__ import annotations

from typing import Any

import pytest

from scripts import audit_report


def case(
    name: str, verdict: str, failed: str | None, expected: tuple[str, str | None]
) -> dict[str, Any]:
    return {
        "case": name,
        "expected": {"verdict": expected[0], "failed": expected[1]},
        "verdict": verdict,
        "failed_at": failed,
        "checks_passed": 3,
    }


def record(cases: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "envelope_sha256": "ab" * 32,
        "envelope_bytes": 10,
        "statement": {"events_counted": 5},
        "cases": cases,
    }


def test_matched_and_detected_are_counted() -> None:
    counted = audit_report.count(
        record(
            [
                case("as exported", "OK", None, ("OK", None)),
                case("edited", "FAILED", "chain", ("FAILED", "chain")),
                case("forged", "FAILED", "counts", ("FAILED", "head")),
            ]
        ),
        ["edited", "forged"],
    )
    assert counted["totals"] == {"cases": 3, "matched": 2, "tampering": 2, "tampering_detected": 2}
    assert counted["envelope"] == {"sha256": "ab" * 32, "bytes": 10}


def test_a_tampering_that_verifies_is_not_detected() -> None:
    counted = audit_report.count(
        record([case("edited", "OK", None, ("FAILED", "chain"))]), ["edited"]
    )
    assert counted["totals"]["tampering_detected"] == 0
    assert counted["totals"]["matched"] == 0


def test_a_missing_tampering_case_is_an_error() -> None:
    with pytest.raises(RuntimeError, match="no case named"):
        audit_report.count(record([]), ["edited"])
