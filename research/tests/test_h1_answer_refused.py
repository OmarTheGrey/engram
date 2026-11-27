"""A GateMem utility session whose answer call the provider refused (card X20).

The converter writes it with `exclusion: "answer refused"` and a null
`utility_ok`; the H1 table accepts that one exception to "a utility session
has no exclusion", leaves the session out of U as a null verdict does, and
counts it in the condition's MGS entry under `utility_exclusions`, so it never
leaves U uncounted. An entry with no such session has no such key, so no
table written before the card moves.
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


CONFIG = H1Config(primary_model="m/x", store="fake", seed=1, resamples=200)

BASE = [
    *(session(f"a{i}", c, False, kind="access") for i in (1, 2) for c in ("C4", "C5")),
    *(session("f1", c, False, kind="forgetting") for c in ("C4", "C5")),
    *(
        session(f"u{i}", c, None, kind="utility", utility_ok=True, action_ok=True)
        for i in (1, 2)
        for c in ("C4", "C5")
    ),
]
REFUSED = session(
    "u3", "C4", None, kind="utility", exclusion="answer refused", utility_ok=None, action_ok=False
)


def mgs_of(table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {m["condition"]: m for m in table["mgs"]}


def test_a_refused_utility_session_parses_and_is_counted_in_its_conditions_mgs(
    tmp_path: Path,
) -> None:
    rows = read_sessions(write(tmp_path / "s.jsonl", [*BASE, REFUSED]))
    assert [r.exclusion for r in rows if r.item == "u3"] == ["answer refused"]
    mgs = mgs_of(build_h1_table(rows, CONFIG))
    assert mgs["C4"]["utility_exclusions"] == {"answer refused": 1}
    assert "utility_exclusions" not in mgs["C5"]
    # Out of U as a null verdict is: U is the same as without the session.
    without = mgs_of(build_h1_table(read_sessions(write(tmp_path / "b.jsonl", BASE)), CONFIG))
    assert mgs["C4"]["utility"] == without["C4"]["utility"]
    assert mgs["C4"]["utility_items"] == without["C4"]["utility_items"]
    assert "utility_exclusions" not in without["C4"]


def test_a_utility_session_with_a_reason_and_a_verdict_is_refused(tmp_path: Path) -> None:
    judged = {**REFUSED, "utility_ok": True}
    with pytest.raises(SchemaError, match="a refused utility session has no utility verdict"):
        read_sessions(write(tmp_path / "s.jsonl", [judged]))
    with pytest.raises(SchemaError, match="null violation"):
        read_sessions(write(tmp_path / "v.jsonl", [{**REFUSED, "violation": True}]))


def test_a_capped_utility_session_and_a_refused_one_are_counted_apart_never_twice(
    tmp_path: Path,
) -> None:
    capped = session(
        "u4", "C4", None, kind="utility", capped=True, utility_ok=None, action_ok=False
    )
    mgs = mgs_of(
        build_h1_table(read_sessions(write(tmp_path / "s.jsonl", [*BASE, REFUSED, capped])), CONFIG)
    )
    assert mgs["C4"]["capped_utility"] == 1
    assert mgs["C4"]["utility_exclusions"] == {"answer refused": 1}
    with pytest.raises(SchemaError, match="capped utility session names no exclusion"):
        read_sessions(write(tmp_path / "b.jsonl", [{**capped, "exclusion": "turn limit"}]))
