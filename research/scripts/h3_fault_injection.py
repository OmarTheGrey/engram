"""The paired fault-injection check for H3 (card X18, proposal U6): change and recovery rates.

Usage:
    uv run python research/scripts/h3_fault_injection.py \\
        --config research/configs/h3-fault-injection.json \\
        --out research/results/h3-fault-injection.json

A proof of concept that supports H3; it is not H3's test. Proposal U6 of the
pre-registration ("Proposed amendments, not yet registered") is not
registered: the lead registered U7 only and keeps U6 an engineering check
unless H3's primary test comes out undecided
(docs/log/2026-11-25-ans-2026-11-25-decision-u6-u7.md). So the result decides
nothing and adds nothing to Holm.

Every question of the pinned cleaned S split (500) is a base: its memory
written through the plane at preset medium as card B5 writes it, read as C5
reads it (the core pipeline, limit 20) at B5's read time, plus one governed
supersession. Three operators (deletion, temporal supersession, missing
metadata) at two places (the projection with the log intact; the log, one
event edited) give six pairs per base, each drawn by the config's seed. The
check itself is TypeScript (packages/bench/src/governance-faults/), reached
through packages/bench/scripts/governance-faults.ts, never reimplemented here:
this script checks the data against its pin (fetching it into .engram/upstream
when the config allows: data only, never a model), splits the bases across
worker processes, joins their lines in question order and reduces them to
counts and rates with Wilson intervals. No model is called. The bytes do not
depend on the worker count (ENGRAM_RESEARCH_WORKERS).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from analysis.wilson import wilson
from scripts.h3_fault_set import MAX_PARTS, ensure_pinned_file, split
from scripts.results_io import load_config, run_node, workers, write_result

ENTRY = "packages/bench/scripts/governance-faults.ts"
CHECK = "packages/bench/src/governance-faults/inject.ts"
OPERATORS = ("deletion", "temporal-supersession", "missing-metadata")
PLACES = ("projection", "log")


def read_questions(path: Path) -> list[Any]:
    """The questions of `path`: upstream's JSON array, or JSON Lines for a .jsonl name."""
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    questions = json.loads(text)
    if not isinstance(questions, list):
        raise ValueError(f"{path}: a LongMemEval file is a JSON array of questions")
    return questions


def run_bases(data: Path, seed: int) -> list[dict[str, Any]]:
    """Every base's outcome line, in question order, from at most MAX_PARTS node processes."""
    questions = read_questions(data)
    ranges = split(len(questions), workers(min(len(questions), MAX_PARTS)))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for part, (lo, hi) in enumerate(ranges):
            with (root / f"part-{part}.jsonl").open("w", encoding="utf-8", newline="\n") as chunk:
                for q in questions[lo:hi]:
                    chunk.write(json.dumps(q, ensure_ascii=False) + "\n")
        del questions

        def run(part: int) -> list[dict[str, Any]]:
            out = root / f"out-{part}.jsonl"
            run_node(
                [
                    ENTRY,
                    "--data",
                    str(root / f"part-{part}.jsonl"),
                    "--seed",
                    str(seed),
                    "--out",
                    str(out),
                ]
            )
            with out.open(encoding="utf-8") as f:
                return [json.loads(line) for line in f if line.strip()]

        with ThreadPoolExecutor(len(ranges)) as pool:
            parts = list(pool.map(run, range(len(ranges))))
    return [base for part in parts for base in part]


def _counts(values: Iterable[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items()))


def rate(successes: int, n: int, confidence: float) -> dict[str, Any]:
    """A share with its Wilson interval; null bounds when n is zero."""
    if n == 0:
        return {"successes": 0, "n": 0, "rate": None, "low": None, "high": None}
    low, high = wilson(successes, n, confidence)
    return {"successes": successes, "n": n, "rate": successes / n, "low": low, "high": high}


def cell(pairs: Sequence[Mapping[str, Any]], confidence: float) -> dict[str, Any]:
    """One operator at one place: change, recovery and detection over its targeted pairs."""
    targeted = [p for p in pairs if p["targeted"]]
    changed = [p for p in targeted if p["changed"]]
    return {
        "pairs": len(pairs),
        "untargeted": len(pairs) - len(targeted),
        "change": rate(len(changed), len(targeted), confidence),
        "recovery": rate(
            sum(1 for p in changed if p["enforced_equals_clean"]), len(changed), confidence
        ),
        "enforced_equals_clean": rate(
            sum(1 for p in targeted if p["enforced_equals_clean"]), len(targeted), confidence
        ),
        "lint_detection": rate(
            sum(1 for p in targeted if p["lint_detected"]), len(targeted), confidence
        ),
        "new_findings_on_target": _counts(lid for p in targeted for lid in p["new_lint_ids"]),
        "verify_detection": rate(
            sum(1 for p in targeted if p["verify"] == "FAILED"), len(targeted), confidence
        ),
        "verify_verdicts": _counts(p["verify"] for p in targeted),
        "verify_first_break": _counts(p["verify_check"] for p in targeted if p["verify_check"]),
    }


def summarise(bases: Sequence[Mapping[str, Any]], confidence: float) -> dict[str, Any]:
    """The cells per operator and place, the per-place totals and the control."""
    pairs = [p for b in bases for p in b["pairs"]]
    for b in bases:
        got = [(p["operator"], p["place"]) for p in b["pairs"]]
        if got != [(o, pl) for o in OPERATORS for pl in PLACES]:
            raise ValueError(f"{b['question_id']}: the pairs are not one per operator and place")
    findings: dict[str, int] = {}
    for b in bases:
        for lid, n in b["clean_findings"].items():
            findings[lid] = findings.get(lid, 0) + n
    return {
        "cells": {
            o: {
                pl: cell([p for p in pairs if p["operator"] == o and p["place"] == pl], confidence)
                for pl in PLACES
            }
            for o in OPERATORS
        },
        "by_place": {pl: cell([p for p in pairs if p["place"] == pl], confidence) for pl in PLACES},
        "control": {
            "bases": len(bases),
            "verify_verdicts": _counts(b["control"]["verify"] for b in bases),
            "verify_failed": sum(1 for b in bases if b["control"]["verify"] == "FAILED"),
            "reads_equal_clean": sum(1 for b in bases if b["control"]["reads_equal_clean"]),
        },
        "state": {
            "turns": sum(int(b["turns"]) for b in bases),
            "b5_read_items": sum(int(b["b5_read"]) for b in bases),
            "clean_read_items": sum(int(b["clean_read"]) for b in bases),
            "bases_with_an_empty_clean_read": sum(1 for b in bases if int(b["clean_read"]) == 0),
            "clean_findings": dict(sorted(findings.items())),
        },
        "pairs": {"total": len(pairs), "targeted": sum(1 for p in pairs if p["targeted"])},
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = ensure_pinned_file(config["data"], fetch=bool(config.get("fetch", False)))
    confidence = float(config.get("confidence", 0.95))
    bases = run_bases(data, int(config["seed"]))
    lines = "".join(json.dumps(b, sort_keys=True) + "\n" for b in bases)
    return {
        "name": config["name"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "proposal": config["proposal"],
        "registered": False,
        "benchmark": config["benchmark"],
        "data": {
            "file": config["data"]["file"],
            "revision": config["data"]["revision"],
            "sha256": config["data"]["sha256"],
        },
        "seed": int(config["seed"]),
        "confidence": confidence,
        "preset": "medium",
        "read_limit": 20,
        "operators": list(OPERATORS),
        "places": list(PLACES),
        "check": CHECK,
        "bases_sha256": hashlib.sha256(lines.encode("utf-8")).hexdigest(),
        **summarise(bases, confidence),
        "limits": list(config["limits"]),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
