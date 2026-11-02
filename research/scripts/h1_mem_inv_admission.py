"""H1 evidence: what the plane's write gate admits of MEM-INV-Bench's poison, by preset.

Usage:
    uv run python research/scripts/h1_mem_inv_admission.py \\
        --config research/configs/h1-mem-inv-admission.json \\
        --out research/results/h1-mem-inv-admission.json

For each vendored case (fixtures/bench/mem-inv-bench) and each bundled preset
(docs/tasks/prereg-v1-plan.md, PR 2, item 3): every memory entry crosses
`Plane.write` as its channel's actor (ADR 0029's mapping), then the operator's
action-time `Plane.read` says which entries reach the model. The plane and the
mapping are TypeScript, reached through
packages/runner/scripts/mem-inv-admission.ts; this script checks the vendored
fixture against its manifest's line hashes and aggregates. No model is called.

"Admitted" means the case's marked entries (the attack's entries of untrusted
origin, or the benign case's entries carrying the legitimate value) reach the
action-time read, so the model's context: an entry the gate stores as a
candidate (a scope that requires review) is written but not admitted.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, line_hashes, load_config, run_node, write_result

ENTRY = "packages/runner/scripts/mem-inv-admission.ts"


def check_fixture(fixtures: Path) -> str:
    """The vendored cases match their manifest line by line; returns the pinned commit."""
    manifest = json.loads((fixtures / "manifest.json").read_text(encoding="utf-8"))
    if line_hashes(fixtures / "cases.jsonl") != manifest["files"]["cases.jsonl"]:
        raise ValueError(f"{fixtures / 'cases.jsonl'} differs from its manifest's line hashes")
    return str(manifest["source"]["commit"])


def _share(count: int, total: int) -> float:
    return count / total if total else 0.0


def case_stats(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    n = len(rows)
    written = sum(1 for r in rows if r["written"])
    active = sum(1 for r in rows if r["active"])
    admitted = sum(1 for r in rows if r["in_read"])
    return {
        "cases": n,
        "written": written,
        "active": active,
        "admitted": admitted,
        "share_written": _share(written, n),
        "share_active": _share(active, n),
        "share_admitted": _share(admitted, n),
    }


def entry_stats(entries: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    n = len(entries)
    admitted = sum(1 for e in entries if e["in_read"])
    return {
        "entries": n,
        "decisions": _counts(e["decision"] for e in entries),
        "statuses": _counts("denied" if e["status"] is None else e["status"] for e in entries),
        "kinds": _counts(e["kind"] for e in entries),
        "admitted": admitted,
        "share_admitted": _share(admitted, n),
    }


def _counts(values: Iterable[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items()))


def summarise(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per preset: by family, by laundering channel, and by each marked entry's channel."""
    out: dict[str, Any] = {}
    for preset in sorted({str(r["preset"]) for r in rows}):
        mine = [r for r in rows if r["preset"] == preset]
        entries = [e for r in mine if r["family"] == "attack" for e in r["marked"]]
        out[preset] = {
            "families": {
                f: case_stats([r for r in mine if r["family"] == f])
                for f in sorted({str(r["family"]) for r in mine})
            },
            "laundering": {
                ch: case_stats([r for r in mine if r["laundering"] == ch])
                for ch in sorted({str(r["laundering"]) for r in mine})
            },
            "poisoned_entries_by_channel": {
                ch: entry_stats([e for e in entries if e["channel"] == ch])
                for ch in sorted({str(e["channel"]) for e in entries})
            },
        }
    return out


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    fixtures = REPO / str(config["fixtures"])
    commit = check_fixture(fixtures)
    presets = sorted(str(p) for p in config["presets"])
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "admission.json"
        run_node(
            [ENTRY, "--fixtures", str(fixtures), "--presets", ",".join(presets), "--out", str(out)]
        )
        rows: list[dict[str, Any]] = json.loads(out.read_text(encoding="utf-8"))["rows"]
    cases = [
        {
            "case_id": r["case_id"],
            "preset": r["preset"],
            "family": r["family"],
            "laundering": r["laundering"],
            "admitted": r["in_read"],
            "marked": [
                {k: e[k] for k in ("entry_id", "channel", "kind", "decision", "status", "in_read")}
                for e in r["marked"]
            ],
        }
        for r in rows
    ]
    return {
        "name": config["name"],
        "benchmark": "mem-inv-bench",
        "commit": commit,
        "mapping": "ADR 0029 (packages/bench/src/mem-inv-bench/plane.ts)",
        "presets": presets,
        "by_preset": summarise(rows),
        "cases": cases,
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
