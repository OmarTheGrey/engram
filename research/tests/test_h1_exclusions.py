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


# Utility sessions the turn limit capped (card X21, lead-decisions item 15).

CAPPED_RUN = [
    session("a", "C4", True, kind="access"),
    session("b", "C4", False, kind="access"),
    session("a", "C5", False, kind="access"),
    session("b", "C5", False, kind="access"),
    session("u1", "C4", None, kind="utility", utility_ok=True, action_ok=True),
    session("u2", "C4", None, kind="utility", utility_ok=None, action_ok=True, capped=True),
    session("u3", "C4", None, kind="utility", utility_ok=None, action_ok=False, capped=True),
    session("u1", "C5", None, kind="utility", utility_ok=True, action_ok=True),
    session("u2", "C5", None, kind="utility", utility_ok=False, action_ok=True),
    session("u3", "C5", None, kind="utility", utility_ok=None, action_ok=True, capped=True),
    # The judge gave no verdict: out of U as before, and not a capped session.
    session("u4", "C5", None, kind="utility", utility_ok=None, action_ok=True),
    # Not capped, said so: in U, and not counted.
    session("u5", "C5", None, kind="utility", utility_ok=True, action_ok=True, capped=False),
    session("f", "C4", True, kind="forgetting"),
    session("f", "C5", False, kind="forgetting"),
    # Another store's and another model's capped sessions: not this table's, or its own rows.
    {
        **session("u9", "C4", None, kind="utility", utility_ok=None, action_ok=True, capped=True),
        "store": "other",
    },
    {
        **session("u9", "C4", None, kind="utility", utility_ok=None, action_ok=True, capped=True),
        "model": "m/y",
    },
]


def _without(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != key} for r in rows]


def _uncapped(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != "capped"} for r in rows]


def test_the_table_counts_the_capped_utility_sessions_per_arm_and_condition(
    tmp_path: Path,
) -> None:
    cfg = H1Config(primary_model="m/x", store="fake", seed=1, resamples=500)
    table = build_h1_table(read_sessions(write(tmp_path / "c.jsonl", CAPPED_RUN)), cfg)
    by = {r["condition"]: r for r in table["rates"]}
    assert by["C4"]["capped_utility"] == 2
    assert by["C5"]["capped_utility"] == 1
    # Utility sessions are in no violation rate, so the exclusions do not move.
    assert by["C4"]["exclusions"] == {} and by["C5"]["exclusions"] == {}
    # Everything else is today's table: MGS's U, A and F, every rate and contrast.
    today = build_h1_table(read_sessions(write(tmp_path / "t.jsonl", _uncapped(CAPPED_RUN))), cfg)
    for r in today["rates"]:
        assert r["capped_utility"] == 0
    for r in today["mgs"]:
        assert r["capped_utility"] == 0
    for part in ("rates", "mgs"):
        assert _without(table[part], "capped_utility") == _without(today[part], "capped_utility")
    assert {**table, "rates": None, "mgs": None} == {**today, "rates": None, "mgs": None}
    # Beside U, the same counts, per model and condition.
    mgs = {(r["model"], r["condition"]): r for r in table["mgs"]}
    assert mgs[("m/x", "C4")]["capped_utility"] == 2
    assert mgs[("m/x", "C5")]["capped_utility"] == 1
    assert mgs[("m/y", "C4")]["capped_utility"] == 1
    assert mgs[("m/x", "C4")]["utility"] == 1.0 and mgs[("m/x", "C4")]["utility_items"] == 1
    assert mgs[("m/x", "C5")]["utility"] == pytest.approx(2 / 3)
    assert mgs[("m/x", "C5")]["utility_items"] == 3


def test_every_set_and_the_sensitivity_table_report_the_same_capped_count(
    tmp_path: Path,
) -> None:
    cfg = H1Config(
        primary_model="m/x",
        store="fake",
        seed=1,
        resamples=500,
        gatemem_primary="access",
        sensitivity_name="without b",
        sensitivity_items=frozenset({"b"}),
    )
    table = build_h1_table(read_sessions(write(tmp_path / "s.jsonl", CAPPED_RUN)), cfg)
    sections = [table["rates"], table["sensitivity"]["rates"]]
    sections += [s["rates"] for s in table["secondary"]]
    assert [s["name"] for s in table["secondary"]] == ["forgetting", "access and forgetting"]
    for rates in sections:
        by = {(r["model"], r["condition"]): r["capped_utility"] for r in rates}
        assert by == {("m/x", "C4"): 2, ("m/x", "C5"): 1}


def test_every_rate_names_its_capped_utility_count_zero_included(tmp_path: Path) -> None:
    rows = [
        session("a", "C4", True, kind="access"),
        session("a", "C5", False, kind="access"),
        {**session("m", "C4", True), "benchmark": "mem-inv-bench"},
        {**session("m", "C5", False), "benchmark": "mem-inv-bench"},
    ]
    table = build_h1_table(
        read_sessions(write(tmp_path / "z.jsonl", rows)),
        H1Config(primary_model="m/x", store="fake", seed=1, resamples=500),
    )
    assert [r["capped_utility"] for r in table["rates"]] == [0, 0, 0, 0]


def test_capped_is_only_a_utility_session_with_no_verdict(tmp_path: Path) -> None:
    ok = [session("u", "C4", None, kind="utility", utility_ok=None, action_ok=True, capped=True)]
    assert read_sessions(write(tmp_path / "ok.jsonl", ok))[0].capped is True
    with pytest.raises(SchemaError, match="capped is a utility session's"):
        read_sessions(
            write(tmp_path / "a.jsonl", [session("a", "C4", None, kind="access", capped=True)])
        )
    with pytest.raises(SchemaError, match="capped is a utility session's"):
        read_sessions(write(tmp_path / "n.jsonl", [session("a", "C4", True, capped=True)]))
    with pytest.raises(SchemaError, match="capped must be"):
        bad = session("u", "C4", None, kind="utility", utility_ok=None, action_ok=True, capped=1)
        read_sessions(write(tmp_path / "b.jsonl", [bad]))
    with pytest.raises(SchemaError, match="no utility verdict"):
        judged = session("u", "C4", None, kind="utility", utility_ok=True, action_ok=True)
        read_sessions(write(tmp_path / "j.jsonl", [{**judged, "capped": True}]))
    # An incomplete verdict is a verdict too: a capped session has none.
    with pytest.raises(SchemaError, match="no utility verdict"):
        missed = session("u", "C4", None, kind="utility", utility_ok=False, action_ok=True)
        read_sessions(write(tmp_path / "f.jsonl", [{**missed, "capped": True}]))
