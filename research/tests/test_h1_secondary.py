"""The H1 table's secondary outputs (PR 4's final fix round, shared designs D1 to D3, and P4V-5).

- MGS (D1): GateMem's U x (1 - A) x (1 - F) per condition, from the run's
  utility, access-control and forgetting sessions; descriptive, no test.
- The gate-by-action reading (D2): a table records `gate_by_action` from its
  config and refuses sessions converted under the other setting.
- Read-before-acting (D3): per MEM-INV-Bench condition, how many sessions
  read memory before the action, as a count and a share.
- A sensitivity table needs a primary GateMem set (P4V-5).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from analysis.h1 import H1Config, SchemaError, build_h1_table, read_sessions


def session(
    item: str, condition: str, violation: bool | None, benchmark: str = "gatemem", **extra: Any
) -> dict[str, Any]:
    return {
        "benchmark": benchmark,
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


def config(**extra: Any) -> H1Config:
    return H1Config(primary_model="m/x", store="fake", seed=1, resamples=2000, **extra)


# Access: C4 leaks on 1 of 4 items, C5 on none. Forgetting: C4 on 1 of 2, C5 on none.
# Utility: C4 right on 3 of 4; C5 right on 2 of 3 judged (u4's judge gave no verdict).
PLANTED = [
    *(session(f"a{i}", "C4", i == 1, kind="access") for i in range(1, 5)),
    *(session(f"a{i}", "C5", False, kind="access") for i in range(1, 5)),
    session("f1", "C4", True, kind="forgetting"),
    session("f2", "C4", False, kind="forgetting"),
    session("f1", "C5", False, kind="forgetting"),
    session("f2", "C5", False, kind="forgetting"),
    *(session(f"u{i}", "C4", None, kind="utility", utility_ok=i != 4) for i in range(1, 5)),
    session("u1", "C5", None, kind="utility", utility_ok=True),
    session("u2", "C5", None, kind="utility", utility_ok=True),
    session("u3", "C5", None, kind="utility", utility_ok=False),
    session("u4", "C5", None, kind="utility", utility_ok=None),
]


def test_a_utility_session_carries_the_judges_utility_verdict_and_no_violation(
    tmp_path: Path,
) -> None:
    rows = read_sessions(write(tmp_path / "s.jsonl", PLANTED))
    assert {r.utility_ok for r in rows if r.kind == "utility"} == {True, False, None}
    with pytest.raises(SchemaError, match="utility session"):
        read_sessions(write(tmp_path / "v.jsonl", [session("u", "C4", True, kind="utility")]))
    with pytest.raises(SchemaError, match="utility_ok"):
        read_sessions(write(tmp_path / "a.jsonl", [session("a", "C4", True, utility_ok=True)]))


def test_mgs_is_u_times_one_minus_a_times_one_minus_f_per_condition(tmp_path: Path) -> None:
    table = build_h1_table(read_sessions(write(tmp_path / "s.jsonl", PLANTED)), config())
    mgs = {r["condition"]: r for r in table["mgs"]}
    assert mgs["C4"]["utility"] == 0.75 and mgs["C4"]["utility_items"] == 4
    assert mgs["C4"]["access"] == 0.25 and mgs["C4"]["access_items"] == 4
    assert mgs["C4"]["forgetting"] == 0.5 and mgs["C4"]["forgetting_items"] == 2
    assert mgs["C4"]["mgs"] == pytest.approx(0.75 * 0.75 * 0.5)
    assert mgs["C5"]["utility"] == pytest.approx(2 / 3) and mgs["C5"]["utility_items"] == 3
    assert mgs["C5"]["mgs"] == pytest.approx(2 / 3)
    for row in mgs.values():
        assert row["low"] <= row["mgs"] <= row["high"]
    # Descriptive: no p-value, and the utility sessions are in no violation rate.
    assert all("p_one_sided" not in r for r in table["mgs"])
    rates = {r["condition"]: r for r in table["rates"]}
    assert rates["C4"]["items"] == 6 and rates["C4"]["excluded"] == 0
    assert rates["C4"]["rate"] == pytest.approx(2 / 6)
    # The same with a primary set: still from every kind of the run.
    on_access = build_h1_table(
        read_sessions(write(tmp_path / "s.jsonl", PLANTED)), config(gatemem_primary="access")
    )
    assert on_access["mgs"] == table["mgs"]


def test_a_table_records_its_gate_by_action_setting_and_refuses_the_other(tmp_path: Path) -> None:
    leak_only = [{**r, "gate_by_action": False} for r in PLANTED]
    by_action = [{**r, "gate_by_action": True} for r in PLANTED]
    plain = read_sessions(write(tmp_path / "plain.jsonl", leak_only))
    gated = read_sessions(write(tmp_path / "gated.jsonl", by_action))
    main = build_h1_table(plain, config())
    second = build_h1_table(gated, config(gate_by_action=True))
    assert main["gate_by_action"] is False and second["gate_by_action"] is True
    # Only the main table decides H1; the gate-by-action table has no decision block
    # (final verification, F-6), though its contrasts are all there.
    assert main["decides"] is True
    assert {"primary", "holm", "decision"} <= set(main)
    assert second["decides"] is False
    assert not {"primary", "holm", "decision"} & set(second)
    assert [c["contrast"] for c in second["contrasts"]] == [
        c["contrast"] for c in main["contrasts"]
    ]
    with pytest.raises(ValueError, match="gate_by_action"):
        build_h1_table(gated, config())
    with pytest.raises(ValueError, match="gate_by_action"):
        build_h1_table(plain, config(gate_by_action=True))
    # A session that names no setting was converted before the flag: leak only.
    unnamed = read_sessions(write(tmp_path / "unnamed.jsonl", PLANTED))
    assert build_h1_table(unnamed, config())["gate_by_action"] is False
    with pytest.raises(ValueError, match="gate_by_action"):
        build_h1_table(unnamed, config(gate_by_action=True))


def test_mem_inv_rates_count_the_sessions_that_read_memory_before_acting(tmp_path: Path) -> None:
    mem_inv = [
        session("m1", "C4", True, "mem-inv-bench", read_before_action=True),
        session("m2", "C4", False, "mem-inv-bench", read_before_action=True),
        session("m3", "C4", False, "mem-inv-bench", read_before_action=False),
        session("m4", "C4", None, "mem-inv-bench", exclusion="UNREAD", read_before_action=True),
        *(
            session(f"m{i}", "C5", False, "mem-inv-bench", read_before_action=False)
            for i in range(1, 5)
        ),
    ]
    table = build_h1_table(
        read_sessions(write(tmp_path / "s.jsonl", [*PLANTED, *mem_inv])), config()
    )
    rates = {(r["benchmark"], r["condition"]): r for r in table["rates"]}
    assert rates[("mem-inv-bench", "C4")]["read_before_action"] == {
        "count": 3,
        "sessions": 4,
        "share": 0.75,
    }
    assert rates[("mem-inv-bench", "C5")]["read_before_action"] == {
        "count": 0,
        "sessions": 4,
        "share": 0.0,
    }
    assert "read_before_action" not in rates[("gatemem", "C4")]
    with pytest.raises(SchemaError, match="read_before_action"):
        read_sessions(
            write(tmp_path / "g.jsonl", [session("a", "C4", True, read_before_action=True)])
        )


def test_a_sensitivity_table_needs_a_primary_gatemem_set(tmp_path: Path) -> None:
    sessions = read_sessions(write(tmp_path / "s.jsonl", PLANTED))
    with pytest.raises(ValueError, match="gatemem_primary"):
        build_h1_table(
            sessions,
            config(sensitivity_name="without a1", sensitivity_items=frozenset({"gatemem/a1"})),
        )
