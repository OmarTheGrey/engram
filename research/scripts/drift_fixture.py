"""Drift on a fixture (card D4): an admitted procedure retired on a changed task, then restored.

Usage:
    uv run python research/scripts/drift_fixture.py \\
        --config research/configs/drift-fixture.json --out research/results/h1-drift-fixture.json

A proof of concept on fixtures and a scripted model, not a hypothesis result:
H5 registers admission, not retirement, and drift is off in every registered
preset and config. The script runs the runner's drift config (the config's
`run_config`, research/configs/d4-drift-fixture.json) offline with
ENGRAM_OFFLINE=1, so every model call replays from committed cassettes and a
miss is an error, then reads what the run wrote: card D3's admitted
procedure, re-validated through Plane.revalidate on a pool with one held-out
task changed and once more on D3's pool. It reports the calls, the changed
tasks, and each re-validation's success rate against the floor
and the plane's decision. The result carries no time and no absolute path; it
is filed under h1- for the results glob only.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

RUN = "packages/runner/scripts/run.ts"


def run_drift(run_config: str, out: Path) -> None:
    """The runner's drift config, offline: a cassette miss fails the run."""
    env = {**os.environ, "ENGRAM_OFFLINE": "1"}
    subprocess.run(
        ["node", RUN, "--config", run_config, "--out", str(out)],
        cwd=REPO,
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
    )


def rate(replay: Mapping[str, Any]) -> dict[str, Any]:
    """The success rate with the procedure over every task and seed of a replay."""
    outcomes = replay["outcomes"]
    successes = sum(float(o["with"]) for o in outcomes)
    return {"trials": len(outcomes), "successes": successes, "rate": successes / len(outcomes)}


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "run"
        run_drift(str(config["run_config"]), out)
        summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
        usage = json.loads((out / "usage.json").read_text(encoding="utf-8"))
        fixture = json.loads((out / "revalidation.json").read_text(encoding="utf-8"))
    thresholds = fixture["policy"]["lints"]["thresholds"]
    phases = {p["name"]: p for p in fixture["phases"]}
    revalidations = []
    for p in summary["phases"]:
        revalidations.append(
            {
                "name": p["name"],
                "environment_changed": p["environment"]["validated"] != p["environment"]["current"],
                "trigger": p["trigger"],
                "outcome": p["outcome"],
                "event": {k: p["event"][k] for k in ("op", "decision", "policy_id")},
                "status_after": p["status"],
                "expected": p["expected"],
                **rate(phases[p["name"]]["replay"]),
            }
        )
    outcomes = [r["outcome"] for r in revalidations]
    return {
        "name": config["name"],
        "hypothesis": "none",
        "status": "proof of concept",
        "run_config": config["run_config"],
        "policy": fixture["policy"]["id"],
        "drift": fixture["policy"]["procedures"]["drift"],
        "floor": thresholds["replay-drift.success-floor"],
        "min_trials": thresholds["replay-drift.min-trials"],
        "procedure": summary["candidate"],
        "held_out_tasks": len(summary["held_out"]),
        "changed_tasks": summary["changed"],
        "admission": rate(phases["admission"]["replay"]),
        "revalidations": revalidations,
        "counts": {
            "revalidations": len(revalidations),
            "retired": outcomes.count("retired"),
            "restored": outcomes.count("restored"),
            "kept": outcomes.count("kept"),
            "mismatches": len(summary["mismatches"]),
        },
        "calls": {"new": usage["calls"]["new"], "cached": usage["calls"]["cached"]},
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    result = compute(load_config(args.config))
    if result["calls"]["new"] != 0:
        print(f"drift_fixture: the run made {result['calls']['new']} new calls", file=sys.stderr)
        return 1
    write_result(args.out, result)
    c = result["counts"]
    print(
        f"drift_fixture: {c['revalidations']} re-validations of {result['procedure']}, "
        f"{c['retired']} retired, {c['restored']} restored; "
        f"{result['calls']['cached']} calls from cassettes, none new"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
