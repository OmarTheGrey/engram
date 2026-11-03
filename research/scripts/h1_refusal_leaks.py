"""H1 evidence: the GateMem checkpoints where a plain refusal is itself scored as a leak.

Usage:
    uv run python research/scripts/h1_refusal_leaks.py \\
        --config research/configs/h1-refusal-leaks.json \\
        --out research/results/h1-refusal-leaks.json

At these checkpoints GateMem's rule-based scorer counts a leak in an answer
that only refuses (a leak target such as "no" inside "No, I can't share
that"), so no condition can avoid a scored leak by refusing. PR 2's reach
result counts them (`refusal_leak`) but does not name them; H1's table names
this list for a sensitivity table without them (research/configs/h1-table.json,
review fix pass of PR 4's part A, item 9). The refusals are the reach
config's own (`refusals_from`), so the two results speak of the same
refusals, and the counts per kind must equal the reach result's under its
primary preset, or the script fails.

The scoring is TypeScript, reached through packages/runner/scripts/refusal-leaks.ts
(gatemem-reach.ts `refusalLeaks`, the function the reach result counts with),
never reimplemented here; this script checks the data against the pinned
hashes (fetching it into .engram/upstream when the config allows) and lists.
No model is called.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import (
    REPO,
    ensure_pinned_gatemem,
    load_config,
    run_node,
    sha256_file,
    write_result,
)

ENTRY = "packages/runner/scripts/refusal-leaks.ts"
KINDS = ("access", "forgetting")


def summarise(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """The checkpoints with a scored refusal, per kind and as H1 session items, all sorted."""
    flagged = [r for r in rows if r["refusals"]]
    return {
        "checkpoints": {k: sum(1 for r in rows if r["kind"] == k) for k in KINDS},
        "counts": {k: sum(1 for r in flagged if r["kind"] == k) for k in KINDS},
        "ids": {
            k: sorted(str(r["checkpoint_id"]) for r in flagged if r["kind"] == k) for k in KINDS
        },
        "items": sorted(f"gatemem/{r['checkpoint_id']}" for r in flagged),
        "rows": sorted(
            (
                {"checkpoint_id": r["checkpoint_id"], "kind": r["kind"], "refusals": r["refusals"]}
                for r in flagged
            ),
            key=lambda r: str(r["checkpoint_id"]),
        ),
    }


def reach_counts(reach: Mapping[str, Any]) -> dict[str, int]:
    """The reach result's refusal-leak counts per kind under its primary preset."""
    kinds = reach["by_preset"][reach["primary_preset"]]["kinds"]
    return {k: int(v["all"]["refusal_leak"]) for k, v in sorted(kinds.items())}


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = REPO / str(config["data"])
    commit = ensure_pinned_gatemem(
        data, REPO / str(config["manifest"]), fetch=bool(config["fetch"])
    )
    refusals = [str(r) for r in load_config(REPO / str(config["refusals_from"]))["refusals"]]
    with tempfile.TemporaryDirectory() as tmp:
        refusal_file = Path(tmp) / "refusals.json"
        refusal_file.write_text(json.dumps(refusals), encoding="utf-8")
        out = Path(tmp) / "rows.json"
        run_node([ENTRY, "--data", str(data), "--refusals", str(refusal_file), "--out", str(out)])
        rows: list[dict[str, Any]] = json.loads(out.read_text(encoding="utf-8"))["rows"]
    summary = summarise(rows)
    reach_path = REPO / str(config["reach"])
    expected = reach_counts(json.loads(reach_path.read_text(encoding="utf-8")))
    if expected != summary["counts"]:
        raise ValueError(
            f"refusal-leak counts {summary['counts']} differ from the reach's {expected}"
        )
    return {
        "name": config["name"],
        "benchmark": "gatemem",
        "commit": commit,
        "refusals": refusals,
        "refusals_from": config["refusals_from"],
        "reach": {"file": config["reach"], "sha256": sha256_file(reach_path), "counts": expected},
        **summary,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
