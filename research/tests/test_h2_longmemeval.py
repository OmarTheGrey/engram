"""Card B6's research scripts without their heavy input.

`make test-repro` reruns both on the pinned S split; these tests check what
needs neither the split nor node: that the configs name card L2's pinned
file, the summary of per-question rows on planted rows, and that the cost
table reads the two baseline configs and H1's candidates.
"""

from __future__ import annotations

import json
from typing import Any

from scripts import h2_longmemeval_cost, h2_longmemeval_ttl
from scripts.results_io import REPO, load_config

CONFIGS = REPO / "research" / "configs"
TTL = CONFIGS / "h2-longmemeval-ttl.json"
COST = CONFIGS / "h2-longmemeval-cost.json"
L2 = CONFIGS / "h3-fault-set.json"


def test_both_configs_name_card_l2_s_pinned_file() -> None:
    pinned = load_config(L2)["data"]
    for path in (TTL, COST):
        assert load_config(path)["data"] == pinned


def test_the_baseline_configs_read_the_same_file_the_scripts_check() -> None:
    data = load_config(TTL)["data"]
    for name in ("h2-longmemeval-c2.json", "h2-longmemeval-c5-medium.json"):
        config = load_config(CONFIGS / name)
        assert (CONFIGS / config["data"]).resolve() == (REPO / data["path"]).resolve()


def cell(hidden: int, answer: int = 0, session: int = 0, age_days: float = 10.0) -> dict[str, Any]:
    return {
        "at": "2023-05-10T12:00:00.000Z",
        "returned": 10 - hidden,
        "hidden": hidden,
        "expired": hidden,
        "outside_validity": 0,
        "not_active": 0,
        "evidence_turns_hidden": answer,
        "evidence_session_turns_hidden": session,
        "oldest_age_seconds": age_days * 86_400,
    }


def row(qid: str, category: str, evidence: int, cells: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "question_id": qid,
        "category": category,
        "turns": 10,
        "evidence_turns": evidence,
        "evidence_session_turns": 2 * evidence,
        "presets": {"medium": {"writes": {"allow": 10}, "clocks": cells}},
    }


ROWS = [
    # Hides two turns, one of them its only evidence turn.
    row("b", "multi-session", 1, {c: cell(2, 1, 2, 120.0) for c in h2_longmemeval_ttl.CLOCKS}),
    # Hides one turn, not its evidence.
    row("a", "temporal-reasoning", 2, {c: cell(1, 0, 0, 95.0) for c in h2_longmemeval_ttl.CLOCKS}),
    # Hides nothing; no evidence turn (an abstention question).
    row("c", "multi-session", 0, {c: cell(0) for c in h2_longmemeval_ttl.CLOCKS}),
]


def test_a_preset_at_a_clock_counts_the_turns_and_questions_it_hides() -> None:
    s = h2_longmemeval_ttl.summarise_cell(ROWS, "medium", "read_time")
    assert s["hidden_turns"] == 3
    assert s["by_cause"] == {"expired": 3, "outside_validity": 0, "not_active": 0}
    assert s["questions_with_hidden_turns"] == 2
    assert s["share_with_hidden_turns"] == 2 / 3
    assert s["questions_losing_evidence"] == 1
    assert s["questions_losing_all_evidence"] == 1
    assert s["evidence_turns_hidden"] == 1
    assert s["questions_losing_evidence_session_turns"] == 1
    assert s["oldest_turn_age_days_max"] == 120.0
    assert s["by_category"]["multi-session"] == {
        "questions": 2,
        "with_hidden_turns": 1,
        "losing_evidence": 1,
        "losing_evidence_session_turns": 1,
    }


def test_the_primary_list_holds_only_questions_with_a_hidden_turn_by_id() -> None:
    listed = h2_longmemeval_ttl.per_question(ROWS, "medium", "read_time")
    assert [q["question_id"] for q in listed] == ["a", "b"]
    assert listed[1] == {
        "question_id": "b",
        "category": "multi-session",
        "turns": 10,
        "hidden_turns": 2,
        "evidence_turns": 1,
        "evidence_turns_hidden": 1,
        "evidence_session_turns": 2,
        "evidence_session_turns_hidden": 2,
        "oldest_turn_age_days": 120.0,
    }


def test_card_l2_s_count_is_compared_with_the_plane_s(tmp_path: Any, monkeypatch: Any) -> None:
    results = tmp_path / "research" / "results"
    results.mkdir(parents=True)
    l2 = results / "h3-fault-set.json"
    l2.write_text(json.dumps({"base": {"past_medium_ttl": {"turns": 3, "questions": 2}}}))
    monkeypatch.setattr(h2_longmemeval_ttl, "REPO", tmp_path)
    check = h2_longmemeval_ttl.l2_check(ROWS, l2)
    assert check["equal"] is True
    assert check["file"] == "research/results/h3-fault-set.json"
    l2.write_text(json.dumps({"base": {"past_medium_ttl": {"turns": 4, "questions": 2}}}))
    assert h2_longmemeval_ttl.l2_check(ROWS, l2)["equal"] is False


def test_the_cost_table_prices_both_baselines_with_h1_s_candidates() -> None:
    config = load_config(COST)
    assert {a["condition"] for a in config["arms"].values()} == {"C2", "C5"}
    for arm in config["arms"].values():
        assert (REPO / arm["config"]).exists()
    candidates = load_config(REPO / config["candidates_from"])["candidates"]
    assert any(c["model"] == "openrouter/openai/gpt-5.6-terra" for c in candidates)
    assert set(config["estimates"]) == {"low", "high"}
    assert h2_longmemeval_cost.CONDITIONS == ("C2", "C5")
