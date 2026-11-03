"""The H1 results schema's exclusion reasons (`h1-sessions/2`; PR 4 part A, review fix, P4A-1).

A session the converter cannot score carries a null violation and the reason
(`exclusion`); the H1 table counts excluded sessions by reason per benchmark,
model and condition, so an exclusion that falls differently on two
conditions is visible beside the rates.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from analysis.h1 import H1Config, SchemaError, build_h1_table, read_sessions


def session(item: str, condition: str, violation: bool | None, **extra: Any) -> dict[str, Any]:
    return {
        "benchmark": "gatemem",
        "model": "m/x",
        "store": "fake",
        "preset": "medium",
        "condition": condition,
        "item": item,
        "seed": 1,
        "violation": violation,
        **extra,
    }


def write(path: Path, rows: list[dict[str, Any]]) -> Path:
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    return path


def test_an_exclusion_names_why_a_null_violation_is_left_out(tmp_path: Path) -> None:
    rows = [session("a", "C4", None, exclusion="no judge verdict")]
    assert read_sessions(write(tmp_path / "x.jsonl", rows))[0].exclusion == "no judge verdict"
    with pytest.raises(SchemaError, match="exclusion names why"):
        read_sessions(write(tmp_path / "y.jsonl", [session("a", "C4", True, exclusion="UNREAD")]))
    with pytest.raises(SchemaError, match="non-empty string"):
        read_sessions(write(tmp_path / "z.jsonl", [session("a", "C4", None, exclusion="")]))


def test_the_table_counts_excluded_sessions_by_reason_per_condition(tmp_path: Path) -> None:
    rows = [
        session("a", "C4", True),
        session("b", "C4", None, exclusion="no judge verdict"),
        session("c", "C4", None),
        session("a", "C5", False),
        session("b", "C5", False),
        session("c", "C5", None, exclusion="no judge verdict"),
    ]
    table = build_h1_table(
        read_sessions(write(tmp_path / "s.jsonl", rows)),
        H1Config(primary_model="m/x", store="fake", seed=1),
    )
    by = {r["condition"]: r for r in table["rates"]}
    assert by["C4"]["exclusions"] == {"no judge verdict": 1, "unstated": 1}
    assert by["C4"]["excluded"] == 2
    assert by["C5"]["exclusions"] == {"no judge verdict": 1}
    assert table["sessions_schema"] == "h1-sessions/2"


# GateMem's checkpoint kind and the sets it splits the table by (review fix pass, item 8).


def test_a_kind_is_gatemems_access_forgetting_or_utility(tmp_path: Path) -> None:
    ok = [session("a", "C4", True, kind="access"), session("b", "C4", False, kind="forgetting")]
    assert [s.kind for s in read_sessions(write(tmp_path / "k.jsonl", ok))] == [
        "access",
        "forgetting",
    ]
    with pytest.raises(SchemaError, match="kind must be"):
        read_sessions(write(tmp_path / "u.jsonl", [session("a", "C4", True, kind="other")]))
    other = {**session("a", "C4", True, kind="access"), "benchmark": "mem-inv-bench"}
    with pytest.raises(SchemaError, match="GateMem's checkpoint kind"):
        read_sessions(write(tmp_path / "m.jsonl", [other]))


def test_a_primary_set_needs_every_gatemem_session_to_name_its_kind(tmp_path: Path) -> None:
    rows = [session("a", "C4", True, kind="access"), session("a", "C5", False)]
    with pytest.raises(SchemaError, match="name no kind"):
        build_h1_table(
            read_sessions(write(tmp_path / "s.jsonl", rows)),
            H1Config(primary_model="m/x", store="fake", seed=1, gatemem_primary="access"),
        )


def test_only_the_primary_sets_p_value_enters_the_decision(tmp_path: Path) -> None:
    # Access: C4 violates on every item, C5 on none. Forgetting: no difference.
    rows = [
        session(f"a{i}", c, c == "C4", kind="access") for i in range(12) for c in ("C4", "C5")
    ] + [session(f"f{i}", c, False, kind="forgetting") for i in range(12) for c in ("C4", "C5")]
    sessions = read_sessions(write(tmp_path / "s.jsonl", rows))
    on_access = build_h1_table(
        sessions, H1Config(primary_model="m/x", store="fake", seed=1, gatemem_primary="access")
    )
    on_forgetting = build_h1_table(
        sessions,
        H1Config(primary_model="m/x", store="fake", seed=1, gatemem_primary="forgetting"),
    )
    assert on_access["primary"]["mean"] == 1.0
    assert on_access["holm"]["p"] == on_access["primary"]["p_one_sided"]
    assert on_forgetting["primary"]["mean"] == 0.0
    assert on_forgetting["decision"]["primary"] == "not supported"
    names = [s["name"] for s in on_access["secondary"]]
    assert names == ["forgetting", "access and forgetting"]
