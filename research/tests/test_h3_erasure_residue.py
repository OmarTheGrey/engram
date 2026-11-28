"""The erasure-residue check (card X19, proposal U7): its config, its reduction and one real run.

`make test-repro` runs every backend and store; these tests run the cheapest
one (SQLite and the MCP memory file, about ten seconds) through node and check
the reduction on it, and check the reduction's rules on a hand-built outcome.
"""

from __future__ import annotations

from typing import Any

import pytest

from scripts import h3_erasure_residue
from scripts.results_io import REPO, load_config

CONFIG = REPO / "research" / "configs" / "h3-erasure-residue.json"


def test_the_config_is_an_engineering_check_of_unregistered_u7() -> None:
    config = load_config(CONFIG)
    assert config["status"] == "engineering check"
    assert config["hypothesis"] == "none"
    assert config["proposal"] == "U7"
    assert config["backends"] == ["sqlite", "postgres"]
    assert config["stores"] == ["files", "mem0", "letta", "mcp-memory"]
    assert any("not yet registered" in s for s in config["limits"])
    assert (REPO / config["cassettes"]).is_dir()


def row(role: str, text: dict[str, str], hash_: dict[str, str] | None = None) -> dict[str, Any]:
    return {"person": 1, "slot": 0, "role": role, "text": text, "hash": hash_ or {}, "before": []}


def outcome(canaries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "backend": "sqlite",
        "store": "files",
        "seed": 1,
        "canaries": canaries,
        "reports": {"left_in_store": 1},
        "searched": {"events": 3},
        "byte_tiers": {
            "db-file": True,
            "db-wal": True,
            "store-files": True,
            "store-history": False,
        },
        "summary_calls": {"hits": 1, "recorded": 0},
    }


def test_residue_outranks_retention_and_retained_hits_are_never_residue() -> None:
    o = outcome(
        [
            row("plain", {"db-file": "residue"}, {"events": "erased-content-hash"}),
            row("promoted", {"projection": "promoted", "db-file": "promoted"}),
            row("left-in-store", {"store-records": "residue"}, {"store-records": "residue"}),
            {**row("never", {}), "before": None},
        ]
    )
    s = h3_erasure_residue.summarise(o, 0.95)
    assert s["tiers"]["db-file"]["residue"]["successes"] == 1
    assert s["tiers"]["db-file"]["retained_by_decision"] == {"promoted": 1}
    assert s["tiers"]["events"]["residue"]["successes"] == 0
    assert s["tiers"]["events"]["retained_by_decision"] == {"erased-content-hash": 1}
    assert s["tiers"]["store-records"]["residue_by_role"] == {"left-in-store": 1}
    assert s["tiers"]["store-history"] is None
    assert s["live_tiers"]["residue"]["successes"] == 1
    assert s["any_tier"]["residue"]["successes"] == 2
    assert s["any_tier"]["never_exposed_found"]["successes"] == 0


def test_a_run_that_recorded_its_summaries_is_refused() -> None:
    o = outcome([row("plain", {})])
    o["summary_calls"] = {"hits": 0, "recorded": 1}
    with pytest.raises(ValueError, match="recorded"):
        h3_erasure_residue.compute(load_config(CONFIG), {"sqlite/files": o})


def test_a_real_run_finds_the_two_store_records_and_no_never_exposed_canary() -> None:
    config = load_config(CONFIG)
    run = h3_erasure_residue.run_check("sqlite", "mcp-memory", int(config["seed"]), config["cassettes"])
    r = h3_erasure_residue.compute(config, {"sqlite/mcp-memory": run})
    s = r["runs"]["sqlite/mcp-memory"]
    assert s["exposed"] == 200
    assert s["before"] == {"projection": 200, "events": 200, "store-records": 200}
    assert s["tiers"]["store-records"]["residue"]["successes"] == 2
    assert s["tiers"]["store-records"]["residue_by_role"] == {"left-in-store": 1, "not-found": 1}
    for tier in ("projection", "explanations", "events", "log-other"):
        assert s["tiers"][tier]["residue"]["successes"] == 0
    assert s["tiers"]["projection"]["retained_by_decision"] == {
        "outside-person-scope": 20,
        "promoted": 20,
    }
    assert s["any_tier"]["never_exposed_found"]["successes"] == 0
    assert r["registered"] is False and r["decides"] is False


def test_make_fixtures_records_the_cassettes_at_the_configs_seed() -> None:
    config = load_config(CONFIG)
    makefile = (REPO / "Makefile").read_text(encoding="utf-8")
    line = next(x for x in makefile.splitlines() if "erasure-residue.ts" in x)
    assert f"--seed {config['seed']}" in line
    assert f"--cassettes {config['cassettes']}" in line
    assert "--record" in line
