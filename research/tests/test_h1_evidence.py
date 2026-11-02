"""The research scripts of PR 4, part A (docs/tasks/prereg-v1-plan.md) without their heavy inputs.

`make test-repro` reruns the real scripts on the real data; these tests check
the parts that need neither: the fixture checks, the aggregations on planted
rows, and the cost arithmetic on planted shapes.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pytest

from scripts import h1_c4_verdict_agreement, h1_c4_walk, h1_cost, h1_mem_inv_admission
from scripts.results_io import REPO, line_hashes, load_config

PINNED_MEM_INV = "cf3c9a4ca9f0478000d6aa26eb268b875232d34b"

# MEM-INV-Bench admission on the full case set (PR 4, deliverable 4).


def test_the_full_mem_inv_case_set_is_checked_under_its_own_manifest_key(tmp_path: Path) -> None:
    fixtures = REPO / "fixtures/bench/mem-inv-bench"
    assert h1_mem_inv_admission.check_fixture(fixtures, "full/cases.jsonl") == PINNED_MEM_INV
    copy = tmp_path / "mib"
    shutil.copytree(fixtures, copy)
    full = copy / "full/cases.jsonl"
    lines = full.read_text(encoding="utf-8").split("\n")
    full.write_text("\n".join(lines[:-2] + lines[-1:]), encoding="utf-8", newline="\n")
    assert line_hashes(full) != line_hashes(fixtures / "full/cases.jsonl")
    with pytest.raises(ValueError, match="line hashes"):
        h1_mem_inv_admission.check_fixture(copy, "full/cases.jsonl")
    # The subset's own key does not vouch for the full set.
    with pytest.raises(ValueError, match="line hashes"):
        h1_mem_inv_admission.check_fixture(fixtures, "full/cases.jsonl", key="cases.jsonl")


def test_the_admission_config_names_the_full_case_set() -> None:
    config = load_config(REPO / "research/configs/h1-mem-inv-admission.json")
    assert config["cases"] == "full/cases.jsonl"
    assert h1_mem_inv_admission.cases_dir(config) == REPO / "fixtures/bench/mem-inv-bench/full"


# C4's verdict agreement (PR 4, deliverable 2), on planted rows.


def agreement(items: int, rag: int, engram: int, agree: int) -> dict[str, int]:
    """Counts whose cells are consistent: `rag` and `engram` allowed, `agree` equal."""
    both = (rag + engram - (items - agree)) // 2
    return {
        "items": items,
        "rag_allows": rag,
        "engram_allows": engram,
        "agree": agree,
        "rag_allows_engram_denies": rag - both,
        "rag_denies_engram_allows": engram - both,
    }


def verdict_row(cid: str, kind: str, all_: dict[str, int], leak: dict[str, int]) -> dict[str, Any]:
    return {"checkpoint_id": cid, "domain": "office", "kind": kind, "all": all_, "leak": leak}


def test_the_verdict_agreement_sums_cells_per_kind_and_on_leak_turns() -> None:
    rows = [
        verdict_row("a", "privacy", agreement(10, 6, 4, 6), agreement(2, 1, 0, 1)),
        verdict_row("b", "privacy", agreement(10, 2, 2, 10), agreement(0, 0, 0, 0)),
        verdict_row("c", "safety", agreement(4, 4, 0, 0), agreement(4, 4, 0, 0)),
    ]
    summary = h1_c4_verdict_agreement.summarise(rows)
    assert summary["all"]["all"] == {
        "items": 24,
        "rag_allows": 12,
        "engram_allows": 6,
        "agree": 16,
        "rag_allows_engram_denies": 7,
        "rag_denies_engram_allows": 1,
        "share_agree": 16 / 24,
        "share_rag_allows_engram_denies": 7 / 24,
        "share_rag_denies_engram_allows": 1 / 24,
        "share_rag_allows": 12 / 24,
        "share_engram_allows": 6 / 24,
        "checkpoints": 3,
    }
    privacy = summary["kinds"]["privacy"]
    assert privacy["all"]["items"] == 20
    assert privacy["leak"]["items"] == 2
    assert privacy["leak"]["rag_allows"] == 1
    assert privacy["leak"]["engram_allows"] == 0
    assert summary["kinds"]["safety"]["leak"]["share_rag_allows_engram_denies"] == 1.0
    # An empty group reports zero shares, not a division by zero.
    assert summary["kinds"]["privacy"]["leak"]["checkpoints"] == 2


def test_the_planted_agreement_cells_are_consistent() -> None:
    a = agreement(10, 6, 4, 6)
    assert a["agree"] + a["rag_allows_engram_denies"] + a["rag_denies_engram_allows"] == 10


# C4's walk counts (PR 4, deliverable 3), on planted rows.


def walk_row(
    cid: str,
    kind: str,
    *,
    candidates: int,
    c4: int,
    c4_allowed: int,
    c3_only: int = 0,
    c4_only: int = 0,
    c3_leak: int = 0,
    c4_leak: int = 0,
) -> dict[str, Any]:
    return {
        "checkpoint_id": cid,
        "domain": "office",
        "kind": kind,
        "candidates": candidates,
        "c3": min(20, candidates),
        "c4": c4,
        "c4_allowed": c4_allowed,
        "c4_denied": c4 - c4_allowed,
        "c5": c4_allowed,
        "c4_allowed_equals_c5": True,
        "c3_allowed": min(c4_allowed, 20),
        "c3_denied_leak": c3_leak,
        "c4_denied_leak": c4_leak,
        "c3_only_denied_leak": c3_only,
        "c4_only_denied_leak": c4_only,
    }


def test_the_walk_counts_name_every_checkpoint_where_c3_and_c4_differ() -> None:
    rows = [
        walk_row("a", "privacy", candidates=50, c4=5, c4_allowed=2, c3_only=1, c3_leak=1),
        walk_row("b", "privacy", candidates=50, c4=0, c4_allowed=0),
        walk_row("c", "privacy", candidates=0, c4=0, c4_allowed=0),
        walk_row("d", "privacy", candidates=80, c4=60, c4_allowed=20, c4_only=2, c4_leak=3),
        walk_row("e", "safety", candidates=10, c4=10, c4_allowed=10),
    ]
    summary = h1_c4_walk.summarise(rows, read_limit=20)
    privacy = summary["kinds"]["privacy"]
    assert privacy["checkpoints"] == 4
    assert privacy["c4_fewer_than_c3"] == 2
    assert privacy["c4_more_than_c3"] == 1
    assert privacy["c4_empty_with_candidates"] == 1
    assert privacy["no_candidates"] == 1
    assert privacy["c3_only_denied_leak"] == {"checkpoints": 1, "items": 1}
    assert privacy["c4_only_denied_leak"] == {"checkpoints": 1, "items": 2}
    assert privacy["items"] == {"c3": 60, "c4": 65, "c4_allowed": 22, "c4_denied": 43, "c5": 22}
    assert summary["kinds"]["safety"]["c4_fewer_than_c3"] == 0
    assert summary["all"]["checkpoints"] == 5
    assert summary["all"]["c4_allowed_equals_c5"] == 5
    assert summary["ids"] == {
        "c4_empty_with_candidates": ["b"],
        "access_control_c3_only_denied_leak": ["a"],
        "access_control_c4_only_denied_leak": ["d"],
    }


def test_the_walk_length_quantiles_follow_the_development_script() -> None:
    rows = [
        walk_row(str(i), "utility", candidates=n, c4=n, c4_allowed=min(n, 20))
        for i, n in enumerate([0, 5, 20, 21, 41, 81, 161, 200])
    ]
    lengths = h1_c4_walk.length_stats([int(r["c4"]) for r in rows], read_limit=20)
    assert lengths == {
        "min": 0,
        "q1": 5,
        "median": 21,
        "q3": 81,
        "max": 200,
        "mean": 66.125,
        "over_limit": 5,
        "histogram": {
            "none": 1,
            "1-19": 1,
            "exactly 20": 1,
            "21-40": 1,
            "41-80": 1,
            "81-160": 1,
            "161+": 2,
        },
    }


# H1's cost table (PR 4, deliverable 1), on planted shapes.


def two_call_session(s: int, t_out: int, t_in: int, r: int, k: int, a: int) -> dict[str, Any]:
    """A fixture session: a read call, then the answer after one memory_read result."""
    return {
        "calls": [
            {"messages": 2, "input_tokens": s, "output_tokens": t_out, "reads": []},
            {
                "messages": 4,
                "input_tokens": s + t_in + r,
                "output_tokens": a,
                "reads": [{"tokens": r, "items": k}],
            },
        ]
    }


def test_a_fixture_condition_s_shape_is_the_mean_of_its_sessions() -> None:
    shape = h1_cost.fixture_shape(
        [two_call_session(100, 8, 10, 50, 5, 20), two_call_session(200, 8, 12, 150, 5, 40)]
    )
    assert shape == {
        "sessions": 2,
        "prompt": 150.0,
        "call_out": 8.0,
        "call_in": 11.0,
        "read_tokens": 100.0,
        "read_items": 5.0,
        "tokens_per_item": 20.0,
        "answer_out": 30.0,
    }


def test_a_session_that_is_not_one_read_then_an_answer_is_refused() -> None:
    one_call = {"calls": [{"messages": 2, "input_tokens": 9, "output_tokens": 3, "reads": []}]}
    with pytest.raises(ValueError, match="one read, then the answer"):
        h1_cost.fixture_shape([one_call])


def test_a_session_s_tokens_grow_with_each_extra_read_turn() -> None:
    shape = h1_cost.fixture_shape([two_call_session(100, 8, 10, 50, 5, 20)])
    # As measured: the read call, then the answer with the call and the result in its input.
    assert h1_cost.session_tokens(shape, items_per_read=5, prompt_delta=0, extra_reads=0) == {
        "calls": 2,
        "input": 260.0,
        "output": 28.0,
    }
    # Two more reads: four calls, each carrying every earlier call and result.
    assert h1_cost.session_tokens(shape, items_per_read=5, prompt_delta=0, extra_reads=2) == {
        "calls": 4,
        "input": 4 * 100 + 60 * (1 + 2 + 3),
        "output": 3 * 8 + 20,
    }
    # The full set's memory: 20 items at the fixture's 10 tokens each; a longer prompt.
    assert h1_cost.session_tokens(shape, items_per_read=20, prompt_delta=40, extra_reads=0) == {
        "calls": 2,
        "input": 2 * 140 + 10 + 200,
        "output": 28.0,
    }


def test_a_price_is_per_million_tokens_and_reasoning_is_output() -> None:
    entry = {"input_per_million": 2.5, "output_per_million": 10, "reasoning": True}
    tokens = {"calls": 4, "input": 1_000_000.0, "output": 2_000_000.0}
    assert h1_cost.price(tokens, 1.0, entry, reasoning_per_call=0) == 22.5
    assert h1_cost.price(tokens, 2.0, entry, reasoning_per_call=0) == 45.0
    # Reasoning tokens are billed as output, per call, for a reasoning model only.
    assert h1_cost.price(tokens, 1.0, entry, reasoning_per_call=250_000) == 22.5 + 10.0
    plain = {**entry, "reasoning": False}
    assert h1_cost.price(tokens, 1.0, plain, reasoning_per_call=250_000) == 22.5


def test_a_refused_model_gets_no_cost() -> None:
    refused = {"model": "openrouter/x/y", "accepted": False, "found": True}
    assert h1_cost.candidate_costs(refused, {}, {}) is None
