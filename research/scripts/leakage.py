"""Card E8.16: the cross-surface leak count, a proof of concept.

Usage:
    uv run python research/scripts/leakage.py \\
        --config research/configs/leakage.json \\
        --out research/results/h1-leakage.json

The four suites the config names (the HTTP API's, MCP's, the CLI's with the
TUI, and the pi extension's) plant the canaries of
packages/server/test/leakage-kit.ts, seeded from the config, through every
write path of a fixture workspace, probe every route, tool and command as a
non-member, an expired grantee, a former member after offboarding and a
partial grantee, and, with ENGRAM_LEAKAGE_OUT naming a folder, each write
the probes they ran there. This script runs them once with vitest (offline,
no model) and counts:

- the canaries written, by write path;
- per surface, the probes run and the canaries any answer carried that its
  actor may not see (a leak), by probe actor;
- per surface, the denied-and-missing comparisons and how many answered
  alike; those that did not are the pinned characterisations, which the
  suites assert exactly;
- per surface, the parity comparisons and how many agreed;
- the positive control's finds, without which a zero would mean nothing.

The suite's own verdict is recorded beside the counts (`suite_passed`); a
leak fails the suite, so a nonzero leak count comes with a false verdict,
and the counts are written all the same. No model is called. The result is a
proof of concept on a fixture workspace, never a hypothesis result.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

VITEST = "node_modules/vitest/vitest.mjs"
SUITES = ("server", "mcp", "cli", "pi")


def run_suites(files: Sequence[str], out: Path) -> bool:
    """Run the suites with vitest, their records into `out`; whether they passed."""
    env = {**os.environ, "ENGRAM_LEAKAGE_OUT": str(out), "ENGRAM_OFFLINE": "1"}
    done = subprocess.run(
        ["node", VITEST, "run", *files],
        cwd=REPO,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if done.returncode != 0:
        # The counts are still written; the run's own report says why it failed.
        sys.stderr.write(done.stdout[-20000:] + done.stderr[-5000:])
    return done.returncode == 0


def load_records(folder: Path) -> dict[str, dict[str, Any]]:
    """Each suite's records; every suite must have written its file."""
    records = {}
    for suite in SUITES:
        path = folder / f"{suite}.json"
        if not path.exists():
            raise RuntimeError(f"the {suite} suite wrote no records ({path.name}); did it run?")
        records[suite] = json.loads(path.read_text(encoding="utf-8"))
    return records


def count(records: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """The counts, from the suites' records (see the module docstring)."""
    canaries = [r["canaries"] for r in records.values()]
    if any(c != canaries[0] for c in canaries):
        raise RuntimeError("the suites planted different canaries")
    actors = [r["probe_actors"] for r in records.values()]
    if any(a != actors[0] for a in actors):
        raise RuntimeError("the suites probed as different actors")
    probe_names = {a["name"] for a in actors[0]}
    surfaces: dict[str, dict[str, Any]] = {}
    others: dict[str, dict[str, Any]] = {}
    for suite in records.values():
        for p in suite["probes"]:
            # The probe actors' probes are the count; the control's and the
            # erasing member's are reported apart.
            into = surfaces if p["actor"] in probe_names else others
            s = into.setdefault(
                p["surface"],
                {
                    "probes": 0,
                    "leaks": 0,
                    "probes_leaking": 0,
                    "by_actor": Counter(),
                    "leaked": Counter(),
                },
            )
            s["probes"] += 1
            s["by_actor"][p["actor"]] += 1
            s["leaks"] += len(p["leaked"])
            s["probes_leaking"] += 1 if p["leaked"] else 0
            s["leaked"].update(p["leaked"])
    shown = {
        name: {
            "probes": s["probes"],
            "leaks": s["leaks"],
            "probes_leaking": s["probes_leaking"],
            "probes_by_actor": dict(sorted(s["by_actor"].items())),
            "leaked_canaries": dict(sorted(s["leaked"].items())),
        }
        for name, s in sorted(surfaces.items())
    }
    other = {
        name: {
            "probes": s["probes"],
            "leaks": s["leaks"],
            "probes_by_actor": dict(sorted(s["by_actor"].items())),
        }
        for name, s in sorted(others.items())
    }
    oracles: dict[str, dict[str, Any]] = {}
    for suite in records.values():
        for o in suite["oracles"]:
            e = oracles.setdefault(
                o["surface"], {"compared": 0, "alike": 0, "characterised": Counter()}
            )
            e["compared"] += 1
            e["alike"] += 1 if o["alike"] else 0
            if not o["alike"]:
                # By the route or tool the comparison names first.
                e["characterised"][o["probe"].split(" ")[0]] += 1
    for e in oracles.values():
        e["characterised"] = dict(sorted(e["characterised"].items()))
    parity: dict[str, dict[str, int]] = {}
    for suite in records.values():
        for p in suite["parity"]:
            e = parity.setdefault(p["surface"], {"operations": 0, "same": 0})
            e["operations"] += 1
            e["same"] += 1 if p["same"] else 0
    controls = {
        c["surface"]: sorted(set(c["found"]))
        for suite in records.values()
        for c in suite["controls"]
    }
    return {
        "canaries": {
            "written": len(canaries[0]),
            "by_write_path": dict(sorted(Counter(c["path"] for c in canaries[0]).items())),
            "labels": [c["label"] for c in canaries[0]],
        },
        "probe_actors": actors[0],
        "surfaces": shown,
        "other_probes": other,
        "totals": {
            "probes": sum(s["probes"] for s in shown.values()),
            "leaks": sum(s["leaks"] for s in shown.values()),
        },
        "denied_and_missing": {k: oracles[k] for k in sorted(oracles)},
        "parity": {k: parity[k] for k in sorted(parity)},
        "positive_control": dict(sorted(controls.items())),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    with tempfile.TemporaryDirectory(prefix="engram-leakage-") as tmp:
        passed = run_suites(config["suite"], Path(tmp))
        counted = count(load_records(Path(tmp)))
    result = {
        "name": config["name"],
        "card": config["card"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "wording": config["wording"],
        "filed_under": config["filed_under"],
        "seed": config["seed"],
        "suite": config["suite"],
        "suite_passed": passed,
        "limits": config["limits"],
        **counted,
    }
    write_result(args.out, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
