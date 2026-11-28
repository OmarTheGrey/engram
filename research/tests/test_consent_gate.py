"""Card E9.12's consent count (research/scripts/consent_gate.py) on planted outcomes.

`make test-repro` runs engram simulate for real; these tests check the
counting alone: consent refusals are counted by opt-out, a refusal naming
no opt-out is not counted as naming one, and a reason that repeats the
refused content is counted as an echo.
"""

from __future__ import annotations

from typing import Any

from scripts import consent_gate


def outcome(step: int, decision: str, policy_id: str, reason: str) -> dict[str, Any]:
    return {
        "step": step,
        "op": "write",
        "decision": decision,
        "policy_id": policy_id,
        "reason": reason,
    }


def run(outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "policy_id": "fixture.p",
        "outcomes": outcomes,
        "utility": {"returned": 1},
        "active": {"person:dana": 1},
    }


ITEMS: list[Any] = [
    {"content": "Blood test results: my health is fine."},
    {"content": {"account": "bank account ending 4411"}},
    {"content": "Team standup is at 09:30 every weekday."},
    None,
]


def test_refusals_are_counted_by_opt_out_and_none_echoes() -> None:
    counted = consent_gate.count_run(
        run(
            [
                outcome(
                    0,
                    "deny",
                    consent_gate.CONSENT_ID,
                    'consent.opt_outs[0] of policy p (topic "health") covers',
                ),
                outcome(
                    1,
                    "deny",
                    consent_gate.CONSENT_ID,
                    "consent.opt_outs[2] of policy p (every write) covers",
                ),
                outcome(2, "allow", "p/write/person", "passes"),
                {
                    "step": 3,
                    "op": "read",
                    "decision": "allow",
                    "policy_id": "p/read/person",
                    "reason": "r",
                },
            ]
        ),
        ITEMS,
    )
    assert counted["writes"] == 3
    assert counted["writes_allowed"] == 1
    assert counted["writes_denied"] == 2
    assert counted["consent_refusals"] == 2
    assert counted["consent_refusals_by_opt_out"] == {"opt_outs[0]": 1, "opt_outs[2]": 1}
    assert counted["consent_refusals_naming_their_opt_out"] == 2
    assert counted["consent_refusals_repeating_content"] == 0
    assert counted["denials_by_rule"] == {consent_gate.CONSENT_ID: 2}


def test_a_reason_repeating_the_content_is_an_echo_and_one_naming_no_opt_out_is_not_named() -> None:
    counted = consent_gate.count_run(
        run(
            [
                outcome(
                    0,
                    "deny",
                    consent_gate.CONSENT_ID,
                    "refused: Blood test results: my health is fine.",
                ),
                outcome(
                    1,
                    "deny",
                    consent_gate.CONSENT_ID,
                    "consent.opt_outs[1] of policy p: bank account ending 4411",
                ),
            ]
        ),
        ITEMS,
    )
    assert counted["consent_refusals_naming_their_opt_out"] == 1
    assert counted["consent_refusals_repeating_content"] == 2


def test_strings_reads_text_keys_and_leaves() -> None:
    assert consent_gate.strings({"a": ["b", {"c": "d"}], "n": 1}) == ["a", "b", "c", "d", "n"]
