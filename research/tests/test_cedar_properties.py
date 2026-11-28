"""Card E2.18: research/scripts/h2_cedar_properties.py without cargo or cvc5.

`make verify-policy` runs the solver; these tests check the parts that need
neither: the result's assembly from planted answers and replays, what counts
as expected, the stable order of a counterexample's entities, the refusal of
a cvc5 at another version, and the exit status when a tool is missing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

from scripts import h2_cedar_properties as cp
from scripts.results_io import REPO, dumps_result, load_config

CONFIG = REPO / "research/configs/h2-cedar-properties.json"


def config() -> dict[str, Any]:
    return load_config(CONFIG)


def job_for(cfg: dict[str, Any]) -> dict[str, Any]:
    """A job with the config's checks, named as tools/symcc/properties.ts names them."""
    checks = []
    for p in cfg["properties"]:
        if p["shape"] == "monotone":
            for a, b in p["pairs"]:
                for action in p["actions"]:
                    checks.append(
                        {
                            "id": f"{p['id']}/{a}-before-{b}/{action}",
                            "property": p["id"],
                            "action": action,
                            "left_preset": a,
                            "right_preset": b,
                        }
                    )
        else:
            actions = ["write", "write_without_review"] if "write" in p["id"] else ["read"]
            for preset in p["presets"]:
                for action in actions:
                    checks.append(
                        {
                            "id": f"{p['id']}/{preset}/{action}",
                            "property": p["id"],
                            "action": action,
                            "left_preset": preset,
                            "right_preset": None,
                        }
                    )
    return {"checks": checks, "domain": "forbid ...", "exports": {"medium": {"rules": 40}}}


CEX: dict[str, Any] = {
    "principal": {"type": "Engram::Actor", "id": ""},
    "action": {"type": "Engram::Action", "id": "read"},
    "resource": {"type": "Engram::Item", "id": ""},
    "context": {},
    "entities": [
        {"uid": {"type": "Engram::Scope", "id": "b"}, "attrs": {"level": "person"}, "parents": []},
        {
            "uid": {"type": "Engram::Actor", "id": ""},
            "attrs": {"level": "person"},
            "parents": [{"type": "Engram::Scope", "id": "b"}, {"type": "Engram::Scope", "id": "a"}],
        },
        {"uid": {"type": "Engram::Scope", "id": "a"}, "attrs": {"level": "org"}, "parents": []},
    ],
    "left_decision": "allow",
    "right_decision": "deny",
}


def answers_and_replays(
    job: dict[str, Any], *, control_reproduced: bool = True, refute: str | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    answers, replays = [], []
    for c in job["checks"]:
        refuted = c["property"] == "read-monotone-reversed" or c["id"] == refute
        answers.append(
            {
                "id": c["id"],
                "action": c["action"],
                "envs": 1,
                "holds": not refuted,
                "counterexample": CEX if refuted else None,
            }
        )
        if refuted:
            reproduced = control_reproduced or c["property"] != "read-monotone-reversed"
            replays.append(
                {
                    "id": c["id"],
                    "faithful": True,
                    "problems": [],
                    "engram": {"action": c["action"]},
                    "left_allows": True,
                    "right_allows": not reproduced,
                    "reproduced": reproduced,
                }
            )
    return answers, replays


def test_every_property_as_expected_on_the_planted_answers() -> None:
    cfg = config()
    job = job_for(cfg)
    answers, replays = answers_and_replays(job)
    result = cp.assemble(cfg, job, answers, replays)
    assert result["status"] == "proof of concept"
    assert result["hypothesis"] == "none"
    assert result["summary"] == {
        "checks": 13,
        "proved": 11,
        "refuted": 2,
        "reproduced": 2,
        "as_expected": 13,
        "all_as_expected": True,
    }
    assert [p["id"] for p in result["properties"]] == [p["id"] for p in cfg["properties"]]
    assert all(p["as_expected"] for p in result["properties"])
    control = result["properties"][-1]["checks"][0]
    assert control["verdict"] == "refuted"
    assert control["right"] == "strict"
    assert control["counterexample"]["reproduced"] is True
    invariant = result["properties"][1]["checks"][0]
    assert invariant["right"] == "the property"
    assert "counterexample" not in invariant
    assert dumps_result(result) == dumps_result(cp.assemble(cfg, job, answers, replays))


def test_a_refuted_property_that_should_hold_is_not_as_expected() -> None:
    cfg = config()
    job = job_for(cfg)
    answers, replays = answers_and_replays(job, refute="model-write-person-scope/medium/write")
    result = cp.assemble(cfg, job, answers, replays)
    assert result["summary"]["all_as_expected"] is False
    prop = next(p for p in result["properties"] if p["id"] == "model-write-person-scope")
    assert prop["as_expected"] is False
    lines = "\n".join(cp.report(result))
    assert "refuted  model-write-person-scope/medium/write (NOT AS EXPECTED)" in lines
    assert "counterexample, as Engram reads it" in lines


def test_a_control_counterexample_the_evaluator_does_not_reproduce_is_not_as_expected() -> None:
    cfg = config()
    job = job_for(cfg)
    answers, replays = answers_and_replays(job, control_reproduced=False)
    result = cp.assemble(cfg, job, answers, replays)
    assert result["summary"]["reproduced"] == 0
    assert result["summary"]["all_as_expected"] is False
    assert result["properties"][-1]["as_expected"] is False


def test_answers_that_miss_a_check_are_refused() -> None:
    cfg = config()
    job = job_for(cfg)
    answers, replays = answers_and_replays(job)
    with pytest.raises(ValueError, match="one for one"):
        cp.assemble(cfg, job, answers[1:], replays)


def test_a_counterexamples_entities_are_put_in_one_order() -> None:
    out = cp.sort_entities(CEX)
    assert [(e["uid"]["type"], e["uid"]["id"]) for e in out["entities"]] == [
        ("Engram::Actor", ""),
        ("Engram::Scope", "a"),
        ("Engram::Scope", "b"),
    ]
    assert [p["id"] for p in out["entities"][0]["parents"]] == ["a", "b"]
    assert CEX["entities"][0]["uid"]["id"] == "b"  # the input is left as it was


def fake_cvc5(tmp_path: Path, version: str) -> Path:
    """A cvc5 stand-in that prints a version line, as a Python script run by a launcher."""
    script = tmp_path / "fake_cvc5.py"
    script.write_text(f"print('cvc5 {version} [git 0000000]')\n", encoding="utf-8")
    if sys.platform == "win32":
        exe = tmp_path / "cvc5.cmd"
        exe.write_text(f'@"{sys.executable}" "{script}" %*\n', encoding="utf-8")
    else:
        exe = tmp_path / "cvc5"
        exe.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{script}" "$@"\n', encoding="utf-8")
        exe.chmod(0o755)
    return exe


def test_cvc5_at_the_pinned_version_is_taken_and_another_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "good").mkdir()
    good = fake_cvc5(tmp_path / "good", "1.4.2")
    monkeypatch.setenv("CVC5", str(good))
    assert cp.find_cvc5(config(), fetch=False) == good
    (tmp_path / "old").mkdir()
    old = fake_cvc5(tmp_path / "old", "1.3.1")
    monkeypatch.setenv("CVC5", str(old))
    with pytest.raises(ValueError, match=r"pins cvc5 1\.4\.2"):
        cp.find_cvc5(config(), fetch=False)


def test_a_missing_cvc5_exits_with_the_skip_status_and_writes_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("CVC5", str(tmp_path / "no-such-cvc5"))
    out = tmp_path / "result.json"
    assert cp.main(["--config", str(CONFIG), "--out", str(out)]) == cp.MISSING
    assert not out.exists()
    assert "cvc5 is missing" in capsys.readouterr().err


def test_the_offline_guard_forbids_fetching_cvc5(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    cfg["tools"]["cvc5"]["upstream"] = str(tmp_path / "upstream")
    monkeypatch.setenv("ENGRAM_OFFLINE", "1")
    monkeypatch.setattr(cp, "platform_key", lambda: "win32-amd64")
    assert cp.pinned_cvc5(cfg, fetch=True) is None


def test_the_committed_result_is_a_proof_of_concept_with_every_property_as_expected() -> None:
    result = json.loads(
        (REPO / "research/results/h2-cedar-properties.json").read_text(encoding="utf-8")
    )
    assert result["status"] == "proof of concept"
    assert result["hypothesis"] == "none"
    assert result["summary"]["all_as_expected"] is True
    for p in result["properties"]:
        for c in p["checks"]:
            assert c["verdict"] == ("proved" if p["expect"] == "holds" else "refuted")
            if c["verdict"] == "refuted":
                assert c["counterexample"]["reproduced"] is True
