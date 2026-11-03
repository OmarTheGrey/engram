"""H1 evidence: how often C4's two verdict sources agree on GateMem's turn items.

Usage:
    uv run python research/scripts/h1_c4_verdict_agreement.py \\
        --config research/configs/h1-c4-verdict-agreement.json \\
        --out research/results/h1-c4-verdict-agreement.json

C4 shows each item it reads with a verdict for the asker (ADR 0031). The
verdict's default source is the plane's own read decision under the preset
C5 enforces (core's evaluateRead, `c4_verdicts: "engram"`); the second is
GateMem's RAG-Policy gate (`"gatemem-rag"`). For every checkpoint of
GateMem's pinned full set and every turn item up to its as-of turn, this
counts where the two agree, where the gate allows what the plane denies, and
the reverse, overall and on the turns that hold one of the checkpoint's leak
targets, per checkpoint kind. The gate, the mapping and the plane are
TypeScript, reached through packages/runner/scripts/c4-evidence.ts (the
development comparison of PR #25, a84dcab, as an entry point), never
reimplemented here; this script checks the data against the pinned hashes
(fetching it into .engram/upstream when the config allows) and aggregates.
No model is called.

Kinds are GateMem's query types: `privacy` (access control), `safety`
(active forgetting) and `utility`. A turn holds a leak target when GateMem's
scorer's own matcher finds one of the checkpoint's `leak_targets` in it.
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

ENTRY = "packages/runner/scripts/c4-evidence.ts"
CELLS = (
    "items",
    "rag_allows",
    "engram_allows",
    "agree",
    "rag_allows_engram_denies",
    "rag_denies_engram_allows",
)


def _share(count: int, total: int) -> float:
    return count / total if total else 0.0


def agreement(rows: Sequence[Mapping[str, Any]], part: str) -> dict[str, Any]:
    """The cells summed over `rows` for `part` ("all" or "leak"), with their shares."""
    sums = {cell: sum(int(r[part][cell]) for r in rows) for cell in CELLS}
    n = sums["items"]
    return {
        **sums,
        "checkpoints": len(rows),
        **{f"share_{cell}": _share(sums[cell], n) for cell in CELLS if cell != "items"},
    }


def _grouped(rows: Iterable[Mapping[str, Any]], key: str) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r[key]), []).append(r)
    return dict(sorted(out.items()))


def summarise(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Overall and per kind: the agreement on every turn item and on the leak-target turns."""

    def both(group: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
        return {"all": agreement(group, "all"), "leak": agreement(group, "leak")}

    return {
        "all": both(rows),
        "kinds": {kind: both(group) for kind, group in _grouped(rows, "kind").items()},
    }


def node_rows(
    data: Path, presets: Sequence[str], what: str, extra: Sequence[str] = ()
) -> dict[str, list[dict[str, Any]]]:
    """The entry point's rows per preset, one node process per preset run side by side."""
    rows: dict[str, list[dict[str, Any]]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        procs = {
            p: subprocess.Popen(
                [
                    "node",
                    ENTRY,
                    "--rows",
                    what,
                    "--data",
                    str(data),
                    "--preset",
                    p,
                    *extra,
                    "--out",
                    str(Path(tmp) / p),
                ],
                cwd=REPO,
            )
            for p in presets
        }
        for p, proc in procs.items():
            if proc.wait() != 0:
                raise RuntimeError(f"{ENTRY} failed under preset {p}")
        for p in presets:
            out = json.loads((Path(tmp) / p).read_text(encoding="utf-8"))
            if out["preset"] != p or out["rows"] != what:
                raise RuntimeError(f"{ENTRY} wrote {out['rows']} under {out['preset']}")
            rows[p] = out["data"]
    return rows


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = REPO / str(config["data"])
    commit = ensure_pinned_gatemem(
        data, REPO / str(config["manifest"]), fetch=bool(config["fetch"])
    )
    presets = sorted(str(p) for p in config["presets"])
    rows = node_rows(data, presets, "verdicts")
    return {
        "name": config["name"],
        "benchmark": "gatemem",
        "commit": commit,
        "sources": {
            "engram": "the plane's read decision under the preset (core evaluateRead)",
            "gatemem-rag": "GateMem's RAG-Policy gate (packages/bench/src/gatemem/rag-policy.ts)",
        },
        "mapping": "ADR 0030 (packages/bench/src/gatemem/plane.ts)",
        "presets": presets,
        "primary_preset": str(config["primary_preset"]),
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
