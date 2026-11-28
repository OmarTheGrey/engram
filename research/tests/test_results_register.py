"""Tests for research/scripts/results_register.py, the generated results register."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from scripts.results_register import (
    HYPOTHESIS_RESULTS,
    STATUSES,
    RegisterError,
    build,
    main,
    path_text,
    resolve,
    value_text,
)

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / "research" / "configs" / "results-register.json"
REGISTER = REPO / "docs" / "research" / "results.md"

ENTRY = """---
date: 2026-11-28
author: test
type: {type}
card: none
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/x.json
  - research/configs/x.json
supersedes: none
---

**What.** w.

**Why.** w.

**Result.** w.

**Consequence.** w.
"""


def test_committed_register_is_current() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    assert REGISTER.read_text(encoding="utf-8") == build(REPO, config), (
        "docs/research/results.md is stale: run make results-register"
    )


def test_register_covers_every_manifest_row_once() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    manifest = (REPO / "research" / "results" / "MANIFEST.md").read_text(encoding="utf-8")
    rows = [line.split("|")[1].strip() for line in manifest.splitlines() if "| research/" in line]
    assert sorted(r["file"] for r in config["results"]) == sorted(rows)


DATA: dict[str, Any] = {
    "a": {"b": [10, 20]},
    "cells": [{"rate": 0.05, "n": 761}, {"rate": 0.1, "n": 1522}, {"rate": 0.1, "n": 9}],
}


def test_resolve_follows_keys_indexes_and_selectors() -> None:
    assert resolve(DATA, ["a", "b", 1]) == 20
    assert resolve(DATA, ["cells", {"rate": 0.05}, "n"]) == 761
    assert resolve(DATA, ["cells", {"rate": 0.1, "n": 9}, "n"]) == 9


@pytest.mark.parametrize(
    ("path", "message"),
    [
        (["cells", {"rate": 0.1}, "n"], "matches 2 elements"),
        (["cells", {"rate": 0.2}, "n"], "matches 0 elements"),
        (["a", "c"], "not found"),
        (["a", "b", 5], "out of range"),
        (["a"], "not a scalar"),
        (["a", "b", True], "a key, an index or a selector"),
    ],
)
def test_resolve_refuses_what_does_not_name_one_scalar(path: list[Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        resolve(DATA, path)


def test_path_and_value_text() -> None:
    assert path_text(["cells", {"rate": 0.05}, "alphas", "0.01", 2]) == (
        "cells[rate=0.05].alphas.0.01[2]"
    )
    assert value_text(1234567) == "1,234,567"
    assert value_text(-1234.5) == "-1,234.5"
    assert value_text(0.000274) == "0.000274"
    assert value_text(3.1e-05) == "0.000031"
    assert value_text(1e16) == "10,000,000,000,000,000.0"
    assert value_text(660296.0) == "660,296.0"
    assert value_text(True) == "true"
    assert value_text(None) == "null"
    assert value_text("drop") == "`drop`"


def _repo(tmp_path: Path, *, entry_type: str = "measurement", sha: str | None = None) -> Path:
    root = tmp_path / "repo"
    (root / "research" / "results").mkdir(parents=True)
    (root / "research" / "configs").mkdir(parents=True)
    (root / "docs" / "log").mkdir(parents=True)
    (root / "docs" / "research").mkdir(parents=True)
    result = root / "research" / "results" / "x.json"
    result.write_bytes(b'{"n": 1500}\n')
    (root / "research" / "configs" / "x.json").write_text("{}\n")
    digest = sha or hashlib.sha256(result.read_bytes()).hexdigest()
    (root / "research" / "results" / "MANIFEST.md").write_text(
        "| file | config | script | commit | sha256 | figure |\n|---|---|---|---|---|---|\n"
        f"| research/results/x.json | research/configs/x.json | research/scripts/x.py | abc | "
        f"{digest} | none |\n",
        encoding="utf-8",
        newline="\n",
    )
    (root / "docs" / "research" / "preregistration.md").write_text("### H1. A\n", newline="\n")
    (root / "docs" / "log" / "2026-11-28-x.md").write_text(
        ENTRY.format(type=entry_type), encoding="utf-8", newline="\n"
    )
    return root


def _config(**changes: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "file": "research/results/x.json",
        "question": "Q?",
        "status": "support artefact",
        "hypothesis": "H1",
        "prereg": "### H1. A",
        "headline": [{"label": "sessions", "path": ["n"]}],
    }
    result.update(changes)
    return {
        "title": "Results register",
        "intro": ["Intro."],
        "groups": [{"id": "H1", "title": "H1. A", "needs": "Runs."}],
        "results": [result],
    }


def test_build_reads_the_value_and_names_the_entry(tmp_path: Path) -> None:
    text = build(_repo(tmp_path), _config())
    assert "| sessions | 1,500 | `n` |" in text
    assert "docs/log/2026-11-28-x.md" in text
    assert "| support artefact | 1 |" in text
    assert "**No hypothesis has a result yet.** Every committed file is a support artefact." in text


def test_an_entry_other_than_a_measurement_leaves_the_register_current(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    before = build(root, _config())
    for kind in ("finding", "decision", "change"):
        (root / "docs" / "log" / f"2026-11-29-{kind}.md").write_text(
            ENTRY.format(type=kind).replace("2026-11-28", "2026-11-29"),
            encoding="utf-8",
            newline="\n",
        )
    assert build(root, _config()) == before


def test_a_new_measurement_entry_changes_the_register(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    before = build(root, _config())
    (root / "docs" / "log" / "2026-11-29-y.md").write_text(
        ENTRY.format(type="measurement").replace("2026-11-28", "2026-11-29"),
        encoding="utf-8",
        newline="\n",
    )
    after = build(root, _config())
    assert after != before
    assert "docs/log/2026-11-29-y.md" in after


@pytest.mark.parametrize(
    ("repo", "config", "message"),
    [
        ({"sha": "0" * 64}, {}, "sha256 does not match"),
        ({"entry_type": "finding"}, {}, "no current measurement entry"),
        ({}, {"prereg": "### H9. B"}, "has no heading"),
        ({}, {"status": "hypothesis result"}, "is not one of"),
        ({}, {"hypothesis": "H2"}, "is not a group"),
        ({}, {"file": "research/results/y.json"}, "MANIFEST row has no section"),
        ({}, {"headline": [{"label": "l", "path": ["m"]}]}, "not found"),
    ],
)
def test_build_refuses(
    tmp_path: Path, repo: dict[str, Any], config: dict[str, Any], message: str
) -> None:
    with pytest.raises(RegisterError, match=message):
        build(_repo(tmp_path, **repo), _config(**config))


def test_check_fails_on_a_stale_register(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    config = tmp_path / "config.json"
    config.write_text(json.dumps(_config()), encoding="utf-8")
    out = root / "docs" / "research" / "results.md"
    args = ["--root", str(root), "--config", str(config), "--out", str(out)]
    assert main([*args, "--check"]) == 1
    assert main(args) == 0
    assert main([*args, "--check"]) == 0
    assert b"\r\n" not in out.read_bytes()


def test_proof_of_concept_is_a_status_that_decides_no_hypothesis() -> None:
    # The lead's request of 2026-11-28: a count that shows the system working
    # on fixtures (card E8.16's zero-leak count first) is registered as such.
    assert "proof of concept" in STATUSES
    assert "decides no hypothesis" in STATUSES["proof of concept"]
    assert "proof of concept" not in HYPOTHESIS_RESULTS
