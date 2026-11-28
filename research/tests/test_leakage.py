"""Card E8.16's leak count (research/scripts/leakage.py) on planted records.

`make test-repro` runs the four suites for real; these tests check the
counting alone: a leak is counted per canary and per probe, the suites must
agree on what they planted, and a missing suite's records are an error.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import leakage

CANARIES = [
    {"label": "a", "path": "write", "scope": "person:dana"},
    {"label": "b", "path": "grants", "scope": "person:dana"},
]
ACTORS = [{"name": "non-member", "actor": "person:mallory"}]


def suite(name: str, probes: list[dict[str, Any]], **more: Any) -> dict[str, Any]:
    return {
        "suite": name,
        "probes": probes,
        "oracles": more.get("oracles", []),
        "parity": more.get("parity", []),
        "controls": more.get("controls", []),
        "canaries": more.get("canaries", CANARIES),
        "probe_actors": ACTORS,
    }


def probe(surface: str, leaked: list[str]) -> dict[str, Any]:
    return {"surface": surface, "probe": "read", "actor": "non-member", "leaked": leaked}


def records(**over: dict[str, Any]) -> dict[str, dict[str, Any]]:
    base = {name: suite(name, [probe("http", [])]) for name in leakage.SUITES}
    return {**base, **over}


def test_a_clean_run_counts_its_probes_and_no_leak() -> None:
    counted = leakage.count(records())
    assert counted["totals"] == {"probes": 4, "leaks": 0}
    assert counted["canaries"]["written"] == 2
    assert counted["canaries"]["by_write_path"] == {"grants": 1, "write": 1}
    assert counted["surfaces"]["http"]["probes_by_actor"] == {"non-member": 4}


def test_each_leaked_canary_is_counted_and_named() -> None:
    leaky = suite("mcp", [probe("mcp", ["a", "b"]), probe("mcp", ["a"]), probe("mcp", [])])
    counted = leakage.count(records(mcp=leaky))
    mcp = counted["surfaces"]["mcp"]
    assert (mcp["probes"], mcp["leaks"], mcp["probes_leaking"]) == (3, 3, 2)
    assert mcp["leaked_canaries"] == {"a": 2, "b": 1}
    assert counted["totals"]["leaks"] == 3


def test_oracles_list_what_did_not_answer_alike() -> None:
    oracles = [
        {"surface": "http", "probe": "readById", "alike": True},
        {"surface": "http", "probe": "explain non-member (another's read)", "alike": False},
        {"surface": "http", "probe": "write non-member dana-person", "alike": False},
        {"surface": "http", "probe": "write eve dana-person", "alike": False},
    ]
    counted = leakage.count(records(server=suite("server", [], oracles=oracles)))
    assert counted["denied_and_missing"] == {
        "http": {"compared": 4, "alike": 1, "characterised": {"explain": 1, "write": 2}}
    }


def test_the_control_and_other_actors_are_counted_apart() -> None:
    probes = [probe("http", []), {**probe("http", []), "actor": "member"}]
    counted = leakage.count(records(server=suite("server", probes)))
    assert counted["surfaces"]["http"]["probes"] == 4
    assert counted["other_probes"]["http"]["probes_by_actor"] == {"member": 1}
    assert counted["totals"]["probes"] == 4


def test_the_suites_must_plant_the_same_canaries() -> None:
    other = suite("pi", [], canaries=CANARIES[:1])
    with pytest.raises(RuntimeError, match="different canaries"):
        leakage.count(records(pi=other))


def test_a_suite_that_wrote_no_records_is_an_error(tmp_path: Path) -> None:
    for name in leakage.SUITES[:-1]:
        (tmp_path / f"{name}.json").write_text(json.dumps(suite(name, [])), encoding="utf-8")
    with pytest.raises(RuntimeError, match="the pi suite wrote no records"):
        leakage.load_records(tmp_path)
