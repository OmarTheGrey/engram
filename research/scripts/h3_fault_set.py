"""H3's seeded-fault set (card L2): counts and hashes of the set over LongMemEval's cleaned S split.

Usage:
    uv run python research/scripts/h3_fault_set.py \\
        --config research/configs/h3-fault-set.json \\
        --out research/results/h3-fault-set.json

The set is every question of the pinned S split (500 questions) as a memory
state built as card B5 builds it, through the plane, with one fault and one
near-miss of each of nine subtypes in four classes injected per question
(`per_question`), labelled with the lints of each tier expected to find each
fault. The generator is TypeScript (packages/bench/src/faults/), reached
through packages/bench/scripts/fault-set.ts, never reimplemented here. This
script checks the data file against its pinned sha256 (fetching it into
.engram/upstream when the config allows: data only, never a model), splits
it across worker processes, joins their output in question order into the
config's `set` directory (states, labels, per-question stats and the
lint-time policy; under .engram/, never committed), and writes only counts
and the sha256 of each set file. The counts per class are split by keyed and
unkeyed (H3, docs/research/preregistration.md). The bytes do not depend on
the worker count (ENGRAM_RESEARCH_WORKERS).

`label_check` is packages/bench/scripts/fault-set-check.ts over the joined
set: card L1's deterministic lints, run by Plane.lint on every state, must
flag every keyed fault by the lint its label expects, no near-miss by the
lint it is a near-miss of, and nothing else with a lint the set measures; the
script fails when they do not. It checks the labels; card L4 measures the
lints.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
import urllib.request
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, run_node, sha256_file, workers, write_result

ENTRY = "packages/bench/scripts/fault-set.ts"
CHECK = "packages/bench/scripts/fault-set-check.ts"
GENERATOR = "packages/bench/src/faults/generate.ts"
SET_FILES = ("policy.json", "states.jsonl", "labels.jsonl", "stats.jsonl")
JOINED = ("states.jsonl", "labels.jsonl", "stats.jsonl")
CLASSES = ("stale", "contradictory", "misplaced", "unsupported")
KINDS = ("fault", "near-miss")
MAX_PARTS = 16


def data_url(data: Mapping[str, Any]) -> str:
    """Where the pinned file is served: the dataset at its revision."""
    return f"{data['dataset']}/resolve/{data['revision']}/{data['file']}"


def ensure_pinned_file(data: Mapping[str, Any], *, fetch: bool) -> Path:
    """The data file at the config's path, its sha256 checked; fetched when missing and allowed.

    Refuses to fetch under ENGRAM_OFFLINE=1. A fetch lands in a `.part` file
    renamed only after its hash matches, so a broken download leaves nothing.
    """
    path = REPO / str(data["path"])
    expected = str(data["sha256"])
    if not path.exists():
        if not fetch:
            raise FileNotFoundError(f"{path} is missing; set fetch in the config")
        if os.environ.get("ENGRAM_OFFLINE") == "1":
            raise RuntimeError(f"{path} is missing and ENGRAM_OFFLINE=1 forbids the fetch")
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_name(path.name + ".part")
        digest = hashlib.sha256()
        with urllib.request.urlopen(data_url(data)) as response, part.open("wb") as f:
            while chunk := response.read(1 << 20):
                digest.update(chunk)
                f.write(chunk)
        if digest.hexdigest() != expected:
            part.unlink()
            raise ValueError(f"fetch {data_url(data)}: sha256 differs from the pin")
        part.replace(path)
    if sha256_file(path) != expected:
        raise ValueError(f"{path}: sha256 differs from the pin {expected}")
    return path


def split(count: int, parts: int) -> list[tuple[int, int]]:
    """`parts` contiguous half-open ranges covering range(count), in order, none empty."""
    parts = max(1, min(parts, count))
    size, extra = divmod(count, parts)
    out: list[tuple[int, int]] = []
    start = 0
    for i in range(parts):
        end = start + size + (1 if i < extra else 0)
        out.append((start, end))
        start = end
    return out


def build_set(data: Path, config: Mapping[str, Any], target: Path) -> None:
    """Run the generator over the data in parallel parts; join them in question order.

    At most MAX_PARTS node processes run at once, whatever the core count, to
    bound memory on a shared machine; the parts are written before any runs,
    so the parsed split is dropped first.
    """
    questions = json.loads(data.read_text(encoding="utf-8"))
    ranges = split(len(questions), workers(min(len(questions), MAX_PARTS)))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for part, (lo, hi) in enumerate(ranges):
            with (root / f"part-{part}.jsonl").open("w", encoding="utf-8", newline="\n") as chunk:
                for q in questions[lo:hi]:
                    chunk.write(json.dumps(q, ensure_ascii=False) + "\n")
        del questions

        def run(part: int) -> Path:
            out = root / f"part-{part}"
            run_node(
                [
                    ENTRY,
                    "--data",
                    str(root / f"part-{part}.jsonl"),
                    "--seed",
                    str(int(config["seed"])),
                    "--per-question",
                    str(int(config["per_question"])),
                    "--out",
                    str(out),
                ]
            )
            return out

        with ThreadPoolExecutor(len(ranges)) as pool:
            outs = list(pool.map(run, range(len(ranges))))
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)
        policies = {(o / "policy.json").read_bytes() for o in outs}
        if len(policies) != 1:
            raise ValueError("the parts wrote different lint-time policies")
        (target / "policy.json").write_bytes(policies.pop())
        for name in JOINED:
            with (target / name).open("wb") as joined:
                for o in outs:
                    with (o / name).open("rb") as f:
                        shutil.copyfileobj(f, joined)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _counts(values: Iterable[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items()))


def by_class(labels: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per class, keyed and unkeyed apart, the faults and near-misses; every cell, zero or not."""
    return {
        c: {
            key: {
                kind: sum(
                    1
                    for la in labels
                    if la["class"] == c and la["keyed"] == (key == "keyed") and la["kind"] == kind
                )
                for kind in KINDS
            }
            for key in ("keyed", "unkeyed")
        }
        for c in CLASSES
    }


def by_subtype(labels: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per subtype: class, keyed or not, the lints its faults expect, faults, near-misses."""
    out: dict[str, Any] = {}
    for st in sorted({str(la["subtype"]) for la in labels}):
        mine = [la for la in labels if la["subtype"] == st]
        faults = [la for la in mine if la["kind"] == "fault"]
        lints = {json.dumps(la["expected"], sort_keys=True) for la in faults}
        classes = {str(la["class"]) for la in mine}
        keyed = {bool(la["keyed"]) for la in mine}
        if len(lints) > 1 or len(classes) != 1 or len(keyed) != 1:
            raise ValueError(f"subtype {st}: its labels disagree on class, keyed or lints")
        out[st] = {
            "class": classes.pop(),
            "keyed": keyed.pop(),
            "expected": json.loads(lints.pop()) if lints else {"deterministic": [], "model": []},
            "fault": len(faults),
            "near-miss": len(mine) - len(faults),
        }
    return out


def by_tier(labels: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per class: faults a model lint should find, those only a deterministic one should, none."""
    out: dict[str, Any] = {}
    for c in CLASSES:
        faults = [la for la in labels if la["class"] == c and la["kind"] == "fault"]
        model = sum(1 for la in faults if la["expected"]["model"])
        det_only = sum(
            1 for la in faults if la["expected"]["deterministic"] and not la["expected"]["model"]
        )
        out[c] = {
            "model": model,
            "deterministic_only": det_only,
            "none": len(faults) - model - det_only,
        }
    return out


def by_lint(labels: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Per tier and lint: faults expecting it, near-misses it must not flag, by keyed."""
    out: dict[str, Any] = {}
    for tier in ("deterministic", "model"):
        lints = sorted(
            {str(x) for la in labels for x in [*la["expected"][tier], *la["near_miss_of"][tier]]}
        )
        out[tier] = {
            lint: {
                key: {
                    "fault": sum(
                        1
                        for la in labels
                        if lint in la["expected"][tier] and la["keyed"] == (key == "keyed")
                    ),
                    "near-miss": sum(
                        1
                        for la in labels
                        if lint in la["near_miss_of"][tier] and la["keyed"] == (key == "keyed")
                    ),
                }
                for key in ("keyed", "unkeyed")
            }
            for lint in lints
        }
    out["none"] = {
        kind: sum(
            1
            for la in labels
            if la["kind"] == kind
            and not any(
                la[f][t] for f in ("expected", "near_miss_of") for t in ("deterministic", "model")
            )
        )
        for kind in KINDS
    }
    return out


def summarise(
    labels: Sequence[Mapping[str, Any]], stats: Sequence[Mapping[str, Any]]
) -> dict[str, Any]:
    """The counts the result commits, from the labels and the per-question stats."""
    return {
        "questions": len(stats),
        "base": {
            "turns": sum(int(s["turns"]) for s in stats),
            "assistant_turns_model_named": sum(int(s["assistant_turns"]) for s in stats),
            "past_medium_ttl": {
                "turns": sum(int(s["past_medium_ttl"]) for s in stats),
                "questions": sum(1 for s in stats if int(s["past_medium_ttl"]) > 0),
            },
        },
        "events": sum(int(s["events"]) for s in stats),
        "labels": {"total": len(labels), **_counts(str(la["kind"]) for la in labels)},
        "by_class": by_class(labels),
        "by_subtype": by_subtype(labels),
        "by_lint": by_lint(labels),
        "by_tier": by_tier(labels),
    }


def label_check(target: Path) -> dict[str, Any]:
    """The deterministic lints over the set, counted by the check script; it fails on a mismatch."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "check.json"
        run_node([CHECK, "--set", str(target), "--out", str(out)])
        result: dict[str, Any] = json.loads(out.read_text(encoding="utf-8"))
    return result


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = dict(config["data"])
    path = ensure_pinned_file(data, fetch=bool(config.get("fetch", False)))
    target = REPO / str(config["set"])
    build_set(path, config, target)
    check = label_check(target)
    labels = read_jsonl(target / "labels.jsonl")
    stats = read_jsonl(target / "stats.jsonl")
    return {
        "name": config["name"],
        "hypothesis": "H3",
        "benchmark": "longmemeval",
        "data": {k: data[k] for k in ("dataset", "revision", "file", "sha256")},
        "generator": GENERATOR,
        "seed": int(config["seed"]),
        "per_question": int(config["per_question"]),
        "set": {
            "directory": str(config["set"]),
            "sha256": {name: sha256_file(target / name) for name in SET_FILES},
        },
        **summarise(labels, stats),
        "label_check": check,
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
