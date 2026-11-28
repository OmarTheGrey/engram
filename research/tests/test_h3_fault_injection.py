"""The paired fault-injection check (card X18, proposal U6) on the vendored LongMemEval subset.

`make test-repro` runs the check on the pinned S split; these tests run it on
the 20 vendored questions (fixtures/bench/longmemeval/questions.jsonl), with
the S split's config's seed, through node, and check the reduction.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import h3_fault_injection
from scripts.results_io import REPO, dumps_result, load_config, sha256_file

CONFIG = REPO / "research" / "configs" / "h3-fault-injection.json"
FAULT_SET = REPO / "research" / "configs" / "h3-fault-set.json"
FIXTURE = REPO / "fixtures" / "bench" / "longmemeval" / "questions.jsonl"


def fixture_config() -> dict[str, Any]:
    config = load_config(CONFIG)
    config["data"] = {
        **config["data"],
        "path": str(FIXTURE.relative_to(REPO)).replace("\\", "/"),
        "sha256": sha256_file(FIXTURE),
    }
    config["fetch"] = False
    return config


_cached: dict[str, dict[str, Any]] = {}


def fixture_result() -> dict[str, Any]:
    if "r" not in _cached:
        _cached["r"] = h3_fault_injection.compute(fixture_config())
    return _cached["r"]


def test_the_config_reads_the_pinned_split_h3s_fault_set_reads() -> None:
    config = load_config(CONFIG)
    assert config["data"] == load_config(FAULT_SET)["data"]
    assert config["status"] == "proof of concept"
    assert config["hypothesis"] == "H3"
    assert config["proposal"] == "U6"


def test_the_result_says_it_is_unregistered_and_projection_faults_recover_by_construction() -> None:
    r = fixture_result()
    assert r["registered"] is False
    assert r["status"] == "proof of concept"
    assert any("not H3's test" in s for s in r["limits"])
    assert any("recovered by replay by construction" in s for s in r["limits"])


def test_every_base_gives_six_pairs_and_a_clean_control() -> None:
    r = fixture_result()
    assert r["control"]["bases"] == 20
    assert r["pairs"]["total"] == 20 * 6
    assert r["control"]["verify_failed"] == 0
    assert r["control"]["reads_equal_clean"] == 20


def test_projection_faults_recover_and_log_faults_are_caught_by_the_chain() -> None:
    r = fixture_result()
    for operator in h3_fault_injection.OPERATORS:
        projection = r["cells"][operator]["projection"]
        log = r["cells"][operator]["log"]
        assert projection["enforced_equals_clean"]["rate"] == 1.0
        assert projection["verify_detection"]["successes"] == 0
        assert log["verify_detection"]["rate"] == 1.0
    assert r["cells"]["deletion"]["log"]["recovery"]["successes"] == 0


def test_a_rate_over_no_pairs_has_no_interval_and_a_full_one_stays_inside_the_unit() -> None:
    assert h3_fault_injection.rate(0, 0, 0.95)["rate"] is None
    full = h3_fault_injection.rate(20, 20, 0.95)
    assert full["rate"] == 1.0
    assert 0.0 < full["low"] < 1.0
    assert full["high"] == 1.0


def test_the_bytes_do_not_depend_on_the_worker_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENGRAM_RESEARCH_WORKERS", "3")
    again = h3_fault_injection.compute(fixture_config())
    assert dumps_result(again) == dumps_result(fixture_result())


def test_the_result_holds_no_longmemeval_text(tmp_path: Path) -> None:
    text = dumps_result(fixture_result())
    for line in FIXTURE.read_text(encoding="utf-8").splitlines()[:3]:
        q = json.loads(line)
        assert q["question"] not in text
        assert q["haystack_sessions"][0][0]["content"][:40] not in text
