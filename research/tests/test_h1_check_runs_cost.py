"""The pre-tag checks' price (card RV6, research/scripts/h1_check_runs_cost.py).

The smoke run's two configs are priced from the fixture data and H1's
committed cost result, so this runs offline; the B1 reference run, which
needs the pinned full set, is priced by `make test-repro` from the MANIFEST
row.
"""

from __future__ import annotations

from typing import Any

from scripts import h1_check_runs_cost
from scripts.results_io import REPO, load_config


def _smoke_only() -> dict[str, Any]:
    config = load_config(REPO / "research/configs/h1-check-runs-cost.json")
    config["runs"] = [r for r in config["runs"] if "smoke" in str(r["config"])]
    return config


def test_the_smoke_run_is_priced_per_session_from_h1s_measured_shapes() -> None:
    result = h1_check_runs_cost.compute(_smoke_only())
    gatemem, mem_inv = result["runs"]
    assert (gatemem["name"], gatemem["sessions"]) == ("smoke-h1-gatemem", 30)
    assert gatemem["per_condition"] == {c: 6 for c in ("C1", "C2", "C3", "C4", "C5")}
    assert gatemem["judge_calls"]["calls_min"] == 30
    assert (mem_inv["name"], mem_inv["sessions"], mem_inv["note_calls"]) == (
        "smoke-h1-mem-inv",
        20,
        1,
    )
    # MEM-INV-Bench has no judge; GateMem's costs one to three attempts a session.
    assert mem_inv["judge_cost"] == {"high": 0, "low": 0}
    for run in result["runs"]:
        assert 0 < run["cost"]["low"] < run["cost"]["high"]
    # C1 is one call a session; C2 to C5 two (low) and four (high, two more reads).
    assert gatemem["tokens"]["low"]["calls"] == 6 + 4 * 6 * 2
    assert gatemem["tokens"]["high"]["calls"] == 6 + 4 * 6 * 4
    assert result["total"]["low"] == gatemem["total"]["low"] + mem_inv["total"]["low"]
    assert result["measured_c1"]["fixture_sessions"] == 4
