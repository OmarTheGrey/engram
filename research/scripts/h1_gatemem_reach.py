"""H1 evidence: how much of GateMem's leak targets the asker can read under ADR 0030's mapping.

Usage:
    uv run python research/scripts/h1_gatemem_reach.py \\
        --config research/configs/h1-gatemem-reach.json \\
        --out research/results/h1-gatemem-reach.json

For every access-control and active-forgetting checkpoint of GateMem's pinned
full set (docs/tasks/prereg-v1-plan.md, PR 2, item 2): the checkpoint's turns
up to its as-of turn go through the plane as their speakers' writes (ADR
0030's mapping, the C5 probe's ingestion), the asker reads with no query, and
each leak target is looked for in the turns that read returns. The plane, the
mapping and the matcher are TypeScript, reached through
packages/runner/scripts/gatemem-reach.ts, never reimplemented here; this
script checks the data against the pinned hashes (fetching it into
.engram/upstream when the config allows) and aggregates the rows.

A checkpoint is "reachable" when at least one of its leak targets sits in a
turn the asker can read: C5 cannot keep that target from the model, so the
share of reachable checkpoints bounds from above what C5 can prevent there.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, ensure_pinned_gatemem, load_config, write_result

ENTRY = "packages/runner/scripts/gatemem-reach.ts"


def _share(count: int, total: int) -> float:
    return count / total if total else 0.0


def stats(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Counts and shares over a group of checkpoint rows (see the module docstring)."""
    n = len(rows)
    targets = sum(r["targets"] for r in rows)
    located = sum(1 for r in rows if r["located"] > 0)
    reachable = sum(1 for r in rows if r["reachable"] > 0)
    every = sum(1 for r in rows if r["targets"] > 0 and r["reachable"] == r["targets"])
    context = sum(1 for r in rows if r["context_leak"])
    unreachable = sum(1 for r in rows if r["located"] > 0 and r["reachable"] == 0)
    return {
        "checkpoints": n,
        "targets": targets,
        "targets_located": sum(r["located"] for r in rows),
        "targets_reachable": sum(r["reachable"] for r in rows),
        "located": located,
        "reachable": reachable,
        "reachable_own": sum(1 for r in rows if r["reachable_own"] > 0),
        "reachable_granted": sum(1 for r in rows if r["reachable_granted"] > 0),
        "every_target_reachable": every,
        "context_leak": context,
        "located_unreachable": unreachable,
        "denied_writes": sum(r["denied_writes"] for r in rows),
        "share_located": _share(located, n),
        "share_reachable": _share(reachable, n),
        "share_every_target_reachable": _share(every, n),
        "share_context_leak": _share(context, n),
        "share_located_unreachable": _share(unreachable, n),
        "share_targets_reachable": _share(sum(r["reachable"] for r in rows), targets),
    }


def _grouped(rows: Iterable[Mapping[str, Any]], key: str) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = {}
    for r in rows:
        out.setdefault("none" if r[key] is None else str(r[key]), []).append(r)
    return dict(sorted(out.items()))


def summarise(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per checkpoint kind: overall, per domain, and per attack type (exploratory)."""
    kinds: dict[str, Any] = {}
    for kind, mine in _grouped(rows, "kind").items():
        kinds[kind] = {
            "all": stats(mine),
            "domains": {d: stats(g) for d, g in _grouped(mine, "domain").items()},
            "attack_types": {a: stats(g) for a, g in _grouped(mine, "attack_type").items()},
        }
    return {"kinds": kinds, "all": stats(rows)}


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = REPO / str(config["data"])
    commit = ensure_pinned_gatemem(
        data, REPO / str(config["manifest"]), fetch=bool(config["fetch"])
    )
    presets = sorted(str(p) for p in config["presets"])
    rows: dict[str, list[dict[str, Any]]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        # One node process per preset, run side by side; each is independent.
        procs = {
            p: subprocess.Popen(
                ["node", ENTRY, "--data", str(data), "--preset", p, "--out", str(Path(tmp) / p)],
                cwd=REPO,
            )
            for p in presets
        }
        for p, proc in procs.items():
            if proc.wait() != 0:
                raise RuntimeError(f"{ENTRY} failed under preset {p}")
        for p in presets:
            out = json.loads((Path(tmp) / p).read_text(encoding="utf-8"))
            if out["preset"] != p:
                raise RuntimeError(f"{ENTRY} wrote preset {out['preset']}, asked for {p}")
            rows[p] = out["rows"]
    first = rows[presets[0]]
    return {
        "name": config["name"],
        "benchmark": "gatemem",
        "commit": commit,
        "mapping": "ADR 0030 (packages/bench/src/gatemem/plane.ts)",
        "presets": presets,
        "identical_across_presets": all(rows[p] == first for p in presets),
        "by_preset": {p: summarise(rows[p]) for p in presets},
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
