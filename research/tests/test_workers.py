"""The worker cap of the H4 scripts (PR 4, part A, review fix pass, P4A-10).

`make test-repro` ran research/scripts/h4_power.py and h4_holm_levels.py out
of memory with one worker per core on a shared machine. ENGRAM_RESEARCH_WORKERS
caps the pool; a result must be byte-identical whatever the cap, since every
cell draws its seeds from the config and its own index.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts import h4_holm_levels, h4_power
from scripts.results_io import WORKERS_ENV, dumps_result, workers

TINY = {
    "name": "h4-tiny",
    "seed": 7,
    "arms": 3,
    "seeds_per_item": 3,
    "margins": [0.1],
    "rates": [0.2, 0.1],
    "kappas": [1.0],
    "seed_models": ["identical"],
    "families": [1],
    "alphas": [0.05],
    "level_kappas": [0.05],
    "target_power": 0.8,
    "simulations_walk": 50,
    "simulations_confirm": 100,
    "ladder_start": 10,
    "ladder_stop": 640,
    "steps_per_doubling": 2,
}


def test_the_cap_comes_from_the_environment_and_never_exceeds_the_jobs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(WORKERS_ENV, "3")
    assert workers(10) == 3
    assert workers(2) == 2
    monkeypatch.delenv(WORKERS_ENV)
    assert 1 <= workers(10) <= 10
    for bad in ("0", "-1", "many"):
        monkeypatch.setenv(WORKERS_ENV, bad)
        with pytest.raises(ValueError, match=WORKERS_ENV):
            workers(10)


def test_the_power_table_is_byte_identical_with_one_worker_or_several(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(WORKERS_ENV, "1")
    one = dumps_result(h4_power.compute(TINY))
    monkeypatch.setenv(WORKERS_ENV, "2")
    several = dumps_result(h4_power.compute(TINY))
    assert one == several


def test_the_holm_record_is_byte_identical_with_one_worker_or_several(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    power = {
        "cells": [
            {"margin": 0.1, "alphas": {"0.01": {"targets": {"1": {"items": 60}}}}},
            {"margin": 0.1, "alphas": {"0.01": {"targets": {"1": {"items": 90}}}}},
        ]
    }
    path = tmp_path / "power.json"
    path.write_text(json.dumps(power), encoding="utf-8")
    config = {
        "name": "h4-holm-tiny",
        "power_result": str(path),
        "committed_alpha": "0.01",
        "family_alpha": 0.05,
        "hypotheses": 2,
    }
    monkeypatch.setenv(WORKERS_ENV, "1")
    one = dumps_result(h4_holm_levels.compute(config))
    monkeypatch.setenv(WORKERS_ENV, "3")
    several = dumps_result(h4_holm_levels.compute(config))
    assert one == several
