"""Card E9.12: consent at the write gate, counted on a fixture workload, a proof of concept.

Usage:
    uv run python research/scripts/consent_gate.py \\
        --config research/configs/consent-gate.json \\
        --out research/results/h1-consent-gate.json

The config names a recorded workload (fixtures/workloads/e9-12-consent.json)
and two policies: the baseline, the twin profile as it is, and the
candidate, the twin profile with a person's opt-outs (a topic, a source with
a carve-out, and an Incognito window with a carve-out). This script replays
the workload under both with `engram simulate --json` (each on a scratch log
and store, no model) and counts, per policy, the writes allowed and denied
and the denials by rule; for the candidate, the consent refusals by opt-out;
and, for every consent refusal, whether its reason names its opt-out and
whether it repeats any of the refused content (it must not). The result is
a proof of concept on a fixture workload, never a hypothesis result.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

CLI = "packages/cli/src/main.ts"
CONSENT_ID = "engram/write/consent"
OPT_OUT = re.compile(r"^consent\.opt_outs\[(\d+)\] of policy ")


def simulate(workload: str, baseline: str, candidate: str) -> dict[str, Any]:
    """The simulator's JSON report of `workload` under the two policies."""
    done = subprocess.run(
        [
            "node",
            CLI,
            "simulate",
            "--workload",
            workload,
            "--policy",
            baseline,
            "--candidate",
            candidate,
            "--json",
        ],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    report = json.loads(done.stdout)
    if not isinstance(report, dict):
        raise RuntimeError("engram simulate --json printed no report")
    return report


def strings(value: Any) -> list[str]:
    """Every string a content holds: the text, or a record's keys and string leaves."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [s for v in value for s in strings(v)]
    if isinstance(value, dict):
        return [s for k, v in value.items() for s in [k, *strings(v)]]
    return []


def count_run(run: Mapping[str, Any], items: Sequence[Any]) -> dict[str, Any]:
    """One policy's counts; `items` holds each step's written item, None for a non-write."""
    writes = [o for o in run["outcomes"] if o["op"] == "write"]
    refusals = [o for o in writes if o["policy_id"] == CONSENT_ID]
    by_opt_out: Counter[str] = Counter()
    named = 0
    echoed = 0
    for o in refusals:
        m = OPT_OUT.match(o["reason"])
        if m:
            named += 1
            by_opt_out[f"opt_outs[{m.group(1)}]"] += 1
        content = items[o["step"]]["content"]
        # A string of the content longer than one word, repeated in the reason, is an echo.
        if any(len(s) > 12 and s in o["reason"] for s in strings(content)):
            echoed += 1
    return {
        "policy_id": run["policy_id"],
        "writes": len(writes),
        "writes_allowed": sum(o["decision"] == "allow" for o in writes),
        "writes_denied": sum(o["decision"] == "deny" for o in writes),
        "denials_by_rule": dict(
            sorted(Counter(o["policy_id"] for o in writes if o["decision"] == "deny").items())
        ),
        "consent_refusals": len(refusals),
        "consent_refusals_by_opt_out": dict(sorted(by_opt_out.items())),
        "consent_refusals_naming_their_opt_out": named,
        "consent_refusals_repeating_content": echoed,
        "items_returned_by_reads": run["utility"]["returned"],
        "active_at_end": dict(sorted(run["active"].items())),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    workload = json.loads((REPO / config["workload"]).read_text(encoding="utf-8"))
    items = [s.get("item") if s["op"] == "write" else None for s in workload["steps"]]
    report = simulate(config["workload"], config["baseline"], config["candidate"])
    if report["model_calls"] != 0:
        raise RuntimeError("the simulator called a model")
    result = {
        "name": config["name"],
        "card": config["card"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "wording": config["wording"],
        "filed_under": config["filed_under"],
        "workload": config["workload"],
        "workload_id": report["workload_id"],
        "baseline_policy": config["baseline"],
        "candidate_policy": config["candidate"],
        "steps": len(workload["steps"]),
        "baseline": count_run(report["baseline"], items),
        "candidate": count_run(report["candidate"], items),
        "steps_changed": len(report["changed"]),
        "model_calls": report["model_calls"],
        "limits": config["limits"],
    }
    write_result(args.out, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
