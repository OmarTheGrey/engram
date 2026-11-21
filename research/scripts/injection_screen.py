"""Card E2.10: the injection screen's escape and false-hold rates on a corpus with benign controls.

Usage:
    uv run python research/scripts/injection_screen.py \\
        --config research/configs/injection-screen.json \\
        --out research/results/h1-injection-screen.json

Every corpus entry is written through the real Plane once per profile of
`content_guards.injection_screen` (off, default, hardened) by
packages/core/scripts/injection-corpus.ts, under a policy that admits every
kind in person scope, so the screen is the only stage that can hold a write.
This script never screens anything itself; it counts the rows:

- escape rate: attacks (expected `hold`) the gate admitted, over attacks;
- false-hold rate: benign controls (expected `admit`) the gate held, over
  benign controls, and per group;
- the by-design group (expected `by-design`): standing preferences written
  by a tool, which the kind-conditioned rules hold on purpose (ADR 0039,
  item 5); reported apart, in neither rate.

Each rate carries a Wilson score interval at the config's confidence. The
screen is a deterministic floor, never a defence: the result says how much
of this corpus it catches and what it costs, nothing about a careful
attacker. The `off` profile must hold nothing, or the script fails. No model
is called.
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

ENTRY = "packages/core/scripts/injection-corpus.ts"


def rate(hits: int, n: int, confidence: float) -> dict[str, Any]:
    """A proportion with its Wilson interval; null bounds for an empty group."""
    if n == 0:
        return {"n": 0, "count": 0, "rate": None, "wilson": None}
    lo, hi = wilson(hits, n, confidence)
    return {"n": n, "count": hits, "rate": hits / n, "wilson": [lo, hi]}


def summarise(
    entries: Sequence[Mapping[str, Any]],
    rows: Sequence[Mapping[str, Any]],
    profiles: Sequence[str],
    confidence: float,
) -> dict[str, Any]:
    by_id = {str(e["id"]): e for e in entries}
    out: dict[str, Any] = {}
    for profile in profiles:
        mine = [r for r in rows if r["profile"] == profile]
        if sorted(str(r["id"]) for r in mine) != sorted(by_id):
            raise ValueError(f"profile {profile}: the rows do not cover the corpus once each")
        held = {str(r["id"]) for r in mine if r["held"]}
        closed = sorted(str(r["id"]) for r in mine if r["failed_closed"])
        attacks = sorted(i for i, e in by_id.items() if e["expected"] == "hold")
        benign = sorted(i for i, e in by_id.items() if e["expected"] == "admit")
        design = sorted(i for i, e in by_id.items() if e["expected"] == "by-design")
        escaped = [i for i in attacks if i not in held]
        false_holds = [i for i in benign if i in held]
        groups = sorted({str(by_id[i]["group"]) for i in benign})
        categories = sorted({str(by_id[i].get("category")) for i in attacks})
        out[profile] = {
            "escape": rate(len(escaped), len(attacks), confidence),
            "escape_by_category": {
                c: rate(
                    sum(1 for i in escaped if by_id[i].get("category") == c),
                    sum(1 for i in attacks if by_id[i].get("category") == c),
                    confidence,
                )
                for c in categories
            },
            "escaped": escaped,
            "false_hold": rate(len(false_holds), len(benign), confidence),
            "false_hold_by_group": {
                g: rate(
                    sum(1 for i in false_holds if by_id[i]["group"] == g),
                    sum(1 for i in benign if by_id[i]["group"] == g),
                    confidence,
                )
                for g in groups
            },
            "false_holds": false_holds,
            "by_design_hold": rate(sum(1 for i in design if i in held), len(design), confidence),
            "by_design_admitted": [i for i in design if i not in held],
            "failed_closed": closed,
        }
    off = out.get("off")
    if off is not None and (
        off["false_hold"]["count"] > 0
        or off["by_design_hold"]["count"] > 0
        or off["escape"]["count"] != off["escape"]["n"]
    ):
        raise ValueError("the off profile held a write: the stage is not off")
    return out


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    corpus_path = REPO / str(config["corpus"])
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    profiles = [str(p) for p in config["profiles"]]
    with tempfile.TemporaryDirectory(prefix="engram-e2-10-") as tmp:
        out = Path(tmp) / "rows.jsonl"
        run_node(
            [
                ENTRY,
                "--corpus",
                str(corpus_path),
                "--profiles",
                ",".join(profiles),
                "--out",
                str(out),
            ]
        )
        rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]
    entries = corpus["entries"]
    return {
        "name": config["name"],
        "kind": config["kind"],
        "hypothesis": config["hypothesis"],
        "wording": config["wording"],
        "corpus": str(config["corpus"]),
        "corpus_sha256": sha256_file(corpus_path),
        "confidence": float(config["confidence"]),
        "counts": {
            group: sum(1 for e in entries if e["group"] == group)
            for group in sorted({str(e["group"]) for e in entries})
        },
        "profiles": summarise(entries, rows, profiles, float(config["confidence"])),
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
