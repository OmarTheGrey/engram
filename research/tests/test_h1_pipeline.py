"""H1's pipeline end to end, offline (docs/tasks/prereg-v1-plan.md, PR 4, part A, deliverable 5).

The fixture probe (research/configs/x1-h1-probe.json) replays from its
committed cassettes with ENGRAM_OFFLINE=1, the converter
(packages/runner/scripts/h1-sessions.ts) turns its GateMem and MEM-INV-Bench
rows into `h1-sessions/1`, and research/scripts/h1_table.py builds the H1
table from them: the chain the live run takes, with a scripted model. The
numbers are the scripted replies' and are not results; nothing here is
written under research/results.

The second test checks the live chain names what it needs: `make h1-table`
reads the folders `make run ... LIVE=1` writes for the two H1 configs, and
the table's config names the same model slot and store as both.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

from analysis.h1 import SESSIONS_SCHEMA, read_sessions
from scripts import h1_table
from scripts.results_io import REPO, load_config

PROBE = "research/configs/x1-h1-probe.json"
CONVERTER = "packages/runner/scripts/h1-sessions.ts"


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=REPO,
        env={**os.environ, "ENGRAM_OFFLINE": "1"},
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=600,
    )


def test_the_fixture_probe_runs_from_cassettes_through_the_converter_to_the_h1_table(
    tmp_path: Path,
) -> None:
    runs = tmp_path / "runs"
    probe = run(["node", "packages/runner/scripts/run.ts", "--config", PROBE, "--out", str(runs)])
    assert "model calls in all: 0 new" in probe.stdout

    sessions = tmp_path / "sessions.jsonl"
    converted = run(
        [
            "node",
            CONVERTER,
            "--config",
            "research/configs/x1-h1-gatemem.json",
            "--run",
            str(runs / "x1-h1-gatemem"),
            "--config",
            "research/configs/x1-h1-mem-inv.json",
            "--run",
            str(runs / "x1-h1-mem-inv"),
            "--out",
            str(sessions),
        ]
    )
    # GateMem: 2 checkpoints x C1 to C5 x 2 seeds; C1's 4 rows and the utility
    # checkpoint's 8 left out. MEM-INV-Bench: 2 cases x C2 to C5 x 3 stores;
    # the benign case's 12 rows left out.
    assert "8 sessions (0 excluded), 4 rows of another condition and 8 without" in converted.stderr
    assert (
        "12 sessions (0 excluded), 0 rows of another condition and 12 without" in converted.stderr
    )

    rows = read_sessions(sessions)
    assert len(rows) == 20
    gatemem = [r for r in rows if r.benchmark == "gatemem"]
    assert {r.condition for r in gatemem} == {"C2", "C3", "C4", "C5"}
    assert {r.preset for r in gatemem if r.condition == "C2"} == {"none"}
    assert {r.preset for r in gatemem if r.condition != "C2"} == {"medium"}
    # The judge's verdict on the scripted answer: no leak.
    assert {r.violation for r in gatemem} == {False}
    mem_inv = [r for r in rows if r.benchmark == "mem-inv-bench"]
    assert {r.store for r in mem_inv} == {"fake", "mem0", "letta"}
    # The recorded proposal of the reference model commits the attacker's value.
    assert {r.violation for r in mem_inv} == {True}
    assert {r.model for r in rows} == {"scripted/scripted-1"}

    config = tmp_path / "h1-fixture.json"
    config.write_text(
        json.dumps(
            {
                "name": "h1-fixture",
                "sessions": str(sessions),
                "primary_model": "scripted/scripted-1",
                "store": "fake",
                "seed": 20261103,
            }
        ),
        encoding="utf-8",
    )
    out = tmp_path / "h1-fixture-table.json"
    assert h1_table.main(["--config", str(config), "--out", str(out)]) == 0
    table = json.loads(out.read_text(encoding="utf-8"))
    assert table["sessions_schema"] == SESSIONS_SCHEMA
    rates = {(r["benchmark"], r["condition"]): r for r in table["rates"]}
    assert set(rates) == {
        (b, c) for b in ("gatemem", "mem-inv-bench") for c in ("C2", "C3", "C4", "C5")
    }
    assert rates[("gatemem", "C5")]["sessions"] == 2
    assert rates[("mem-inv-bench", "C4")]["rate"] == 1.0
    assert table["primary"]["contrast"] == "C4-C5"
    assert table["primary"]["benchmark"] == "gatemem"
    assert table["decision"]["h1"] in {"supported", "not supported", "undecided"}


def test_the_live_chain_names_both_arms_runs_and_one_model_slot() -> None:
    makefile = (REPO / "Makefile").read_text(encoding="utf-8")
    recipe = re.search(r"^h1-table:.*\n((?:\t.*\n)+)", makefile, flags=re.M)
    assert recipe is not None, "the Makefile has no h1-table target"
    lines = recipe.group(1)
    table = load_config(REPO / "research/configs/h1-table.json")
    for arm in ("h1-gatemem", "h1-mem-inv"):
        arm_config = load_config(REPO / f"research/configs/{arm}.json")
        # make run CONFIG=research/configs/<arm>.json LIVE=1 writes .engram/runs/<arm>-live.
        assert f"--config research/configs/{arm}.json --run .engram/runs/{arm}-live" in lines
        assert arm_config["model"] == table["primary_model"]
        assert arm_config["store"] == table["store"]
    assert f"--out {table['sessions']}" in lines
    assert "research/scripts/h1_table.py --config research/configs/h1-table.json" in lines
