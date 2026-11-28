"""Card D5: the procedure safety scan's hold and false-hold rates on a hand-labelled corpus.

Usage:
    uv run python research/scripts/procedure_scan.py \\
        --config research/configs/procedure-scan.json \\
        --out research/results/h5-procedure-scan.json

Every corpus case is presented to the real Plane.promote as a procedural
candidate with a replay that passes 5 of 5, once per mode of
`procedures.safety_scan` (off, report, hold), by
packages/core/scripts/procedural-corpus.ts. The replay alone would admit
every case, so the scan is the only stage that can hold one. This script
never scans anything itself; it counts the rows:

- hold rate: unsafe cases (expected `hold`) the plane did not admit, over
  unsafe cases, and per class;
- false-hold rate: safe controls (expected `admit`) the plane did not admit,
  over safe controls, and per group (near-miss, warning, ordinary, hard
  negative).

Each rate carries a Wilson score interval at the config's confidence. The
off and report modes must admit every case, or the script fails: neither
changes a decision. A proof of concept on a corpus the card's author wrote,
never a hypothesis result. No model is called.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.wilson import wilson
from scripts.results_io import REPO, load_config, run_node, sha256_file, write_result

ENTRY = "packages/core/scripts/procedural-corpus.ts"


def rate(hits: int, n: int, confidence: float) -> dict[str, Any]:
    """A proportion with its Wilson interval; null bounds for an empty group."""
    if n == 0:
        return {"n": 0, "count": 0, "rate": None, "wilson": None}
    lo, hi = wilson(hits, n, confidence)
    return {"n": n, "count": hits, "rate": hits / n, "wilson": [lo, hi]}


def summarise(
    cases: Sequence[Mapping[str, Any]],
    rows: Sequence[Mapping[str, Any]],
    modes: Sequence[str],
    confidence: float,
) -> dict[str, Any]:
    by_id = {str(c["id"]): c for c in cases}
    out: dict[str, Any] = {}
    for mode in modes:
        mine = [r for r in rows if r["mode"] == mode]
        if sorted(str(r["id"]) for r in mine) != sorted(by_id):
            raise ValueError(f"mode {mode}: the rows do not cover the corpus once each")
        held = {str(r["id"]) for r in mine if r["held"]}
        unsafe = sorted(i for i, c in by_id.items() if c["expected"] == "hold")
        safe = sorted(i for i, c in by_id.items() if c["expected"] == "admit")
        classes = sorted({str(by_id[i]["class"]) for i in unsafe})
        groups = sorted({str(by_id[i]["group"]) for i in safe})
        out[mode] = {
            "hold": rate(sum(1 for i in unsafe if i in held), len(unsafe), confidence),
            "hold_by_class": {
                k: rate(
                    sum(1 for i in unsafe if i in held and by_id[i]["class"] == k),
                    sum(1 for i in unsafe if by_id[i]["class"] == k),
                    confidence,
                )
                for k in classes
            },
            "missed": [i for i in unsafe if i not in held],
            "false_hold": rate(sum(1 for i in safe if i in held), len(safe), confidence),
            "false_hold_by_group": {
                g: rate(
                    sum(1 for i in safe if i in held and by_id[i]["group"] == g),
                    sum(1 for i in safe if by_id[i]["group"] == g),
                    confidence,
                )
                for g in groups
            },
            "false_holds": [i for i in safe if i in held],
            "decided_by": {
                p: sum(1 for r in mine if r["policy_id"] == p)
                for p in sorted({str(r["policy_id"]) for r in mine})
            },
        }
    for mode in ("off", "report"):
        if mode in out and (out[mode]["hold"]["count"] > 0 or out[mode]["false_hold"]["count"] > 0):
            raise ValueError(f"the {mode} mode held a case: it must change no decision")
    return out


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    corpus_path = REPO / str(config["corpus"])
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    modes = [str(m) for m in config["modes"]]
    with tempfile.TemporaryDirectory(prefix="engram-d5-") as tmp:
        out = Path(tmp) / "rows.jsonl"
        run_node(
            [
                ENTRY,
                "rows",
                "--corpus",
                str(corpus_path),
                "--modes",
                ",".join(modes),
                "--out",
                str(out),
            ]
        )
        rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]
    cases = corpus["cases"]
    return {
        "name": config["name"],
        "kind": config["kind"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "wording": config["wording"],
        "corpus": str(config["corpus"]),
        "corpus_sha256": sha256_file(corpus_path),
        "confidence": float(config["confidence"]),
        "counts": {
            group: sum(1 for c in cases if c["group"] == group)
            for group in sorted({str(c["group"]) for c in cases})
        },
        "modes": summarise(cases, rows, modes, float(config["confidence"])),
        "limits": list(config["limits"]),
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
