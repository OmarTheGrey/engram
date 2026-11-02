"""The research scripts of PR 4, part A (docs/tasks/prereg-v1-plan.md) without their heavy inputs.

`make test-repro` reruns the real scripts on the real data; these tests check
the parts that need neither: the fixture checks, the aggregations on planted
rows, and the cost arithmetic on planted shapes.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from scripts import h1_mem_inv_admission
from scripts.results_io import REPO, line_hashes, load_config

PINNED_MEM_INV = "cf3c9a4ca9f0478000d6aa26eb268b875232d34b"

# MEM-INV-Bench admission on the full case set (PR 4, deliverable 4).


def test_the_full_mem_inv_case_set_is_checked_under_its_own_manifest_key(tmp_path: Path) -> None:
    fixtures = REPO / "fixtures/bench/mem-inv-bench"
    assert h1_mem_inv_admission.check_fixture(fixtures, "full/cases.jsonl") == PINNED_MEM_INV
    copy = tmp_path / "mib"
    shutil.copytree(fixtures, copy)
    full = copy / "full/cases.jsonl"
    lines = full.read_text(encoding="utf-8").split("\n")
    full.write_text("\n".join(lines[:-2] + lines[-1:]), encoding="utf-8", newline="\n")
    assert line_hashes(full) != line_hashes(fixtures / "full/cases.jsonl")
    with pytest.raises(ValueError, match="line hashes"):
        h1_mem_inv_admission.check_fixture(copy, "full/cases.jsonl")
    # The subset's own key does not vouch for the full set.
    with pytest.raises(ValueError, match="line hashes"):
        h1_mem_inv_admission.check_fixture(fixtures, "full/cases.jsonl", key="cases.jsonl")


def test_the_admission_config_names_the_full_case_set() -> None:
    config = load_config(REPO / "research/configs/h1-mem-inv-admission.json")
    assert config["cases"] == "full/cases.jsonl"
    assert h1_mem_inv_admission.cases_dir(config) == REPO / "fixtures/bench/mem-inv-bench/full"
