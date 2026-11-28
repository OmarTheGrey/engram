"""Card E9.15: the signed audit report on a fixture log, a proof of concept.

Usage:
    uv run python research/scripts/audit_report.py \\
        --config research/configs/audit-report.json \\
        --out research/results/h1-audit-report.json

The core suite the config names (packages/core/test/unit/audit/report.test.ts)
builds a chained fixture log with a seeded salt source, checkpoints it with a
fixed Ed25519 key, exports the window's content-free statement as a DSSE
envelope of an in-toto Statement, and verifies it against the log in each of
the config's cases: as exported, after a later write, the statement changed
or re-signed under another key, a false count or head signed with the
operator's key, an event edited (alone, rehashed, rehashed with the
checkpoints deleted), another policy given, and no key pinned. With
ENGRAM_AUDIT_OUT naming a folder, it writes what each case answered there.
This script runs it once with vitest on SQLite (offline, no model) and
records, per case, the verdict expected and given and the check it failed at;
how many cases matched; how many tampering cases were detected; and the
envelope's sha256, which is fixed by the log, the clock and the key.

No model is called. The result is a proof of concept on one fixture log,
never a hypothesis result.
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

VITEST = "node_modules/vitest/vitest.mjs"


def run_suite(files: Sequence[str], out: Path) -> bool:
    """Run the suite with vitest on SQLite, its record into `out`; whether it passed."""
    env = {
        **os.environ,
        "ENGRAM_AUDIT_OUT": str(out),
        "ENGRAM_OFFLINE": "1",
        # The record is SQLite's; Postgres runs of the same file write none.
        "ENGRAM_PG": "skip",
    }
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
        sys.stderr.write(done.stdout[-20000:] + done.stderr[-5000:])
    return done.returncode == 0


def load_record(folder: Path) -> dict[str, Any]:
    path = folder / "records.json"
    if not path.exists():
        raise RuntimeError(f"the suite wrote no record ({path.name}); did it run?")
    record = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(record, dict):
        raise RuntimeError("the record is not a JSON object")
    return record


def count(record: Mapping[str, Any], tampering: Sequence[str]) -> dict[str, Any]:
    """The counts, from the suite's record (see the module docstring)."""
    cases = list(record["cases"])
    names = [c["case"] for c in cases]
    missing = [t for t in tampering if t not in names]
    if missing:
        raise RuntimeError(f"the record has no case named {missing[0]!r}")
    matched = [
        c
        for c in cases
        if c["verdict"] == c["expected"]["verdict"] and c["failed_at"] == c["expected"]["failed"]
    ]
    tampered = [c for c in cases if c["case"] in tampering]
    return {
        "cases": cases,
        "totals": {
            "cases": len(cases),
            "matched": len(matched),
            "tampering": len(tampered),
            "tampering_detected": sum(1 for c in tampered if c["verdict"] == "FAILED"),
        },
        "envelope": {
            "sha256": record["envelope_sha256"],
            "bytes": record["envelope_bytes"],
        },
        "statement": record["statement"],
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    with tempfile.TemporaryDirectory(prefix="engram-audit-") as tmp:
        passed = run_suite(config["suite"], Path(tmp))
        counted = count(load_record(Path(tmp)), config["tampering"])
    result = {
        "name": config["name"],
        "card": config["card"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "wording": config["wording"],
        "filed_under": config["filed_under"],
        "suite": config["suite"],
        "suite_passed": passed,
        "limits": config["limits"],
        **counted,
    }
    write_result(args.out, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
