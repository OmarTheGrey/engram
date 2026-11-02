"""The label-audit sample: seeded sheets for two members to fill in locally.

Usage:
    uv run python research/scripts/label_audit_sample.py \\
        --config research/configs/label-audit.json [--out .engram/audit]

Plan decision 9 of docs/tasks/prereg-v1-plan.md (ADR 0015; pre-registration,
Benchmarks: "before any run, 50 items per benchmark are label-audited by two
members and the disagreement rate is reported"). For each H1 benchmark the
config names:

- GateMem: from the pinned full set (checked against the pinned hashes,
  fetched into .engram/upstream when the config allows), a seeded sample of
  `per_kind` access-control and `per_kind` active-forgetting checkpoints,
  the items H1's violation rate is computed on;
- MEM-INV-Bench: every case of the vendored full set (38, fewer than 50),
  checked against its manifest.

Each benchmark gets one sheet per member, `<out>/<benchmark>-<member>.csv`,
with what the item is, its benchmark label and the scoring keys, a context
file per item under `<out>/context/<benchmark>/`, and empty columns for the
member's own label, a yes or no on the scoring keys, and a comment. The
sheets hold benchmark content, so they are written only under `.engram/`
(which git ignores) or outside the repository, and an existing sheet is never
overwritten: a member's filled sheet is the audit. docs/research/label-audit.md
is the how-to; research/scripts/label_audit_agreement.py reads the filled
sheets. No model is called.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import numpy as np

from scripts.h1_mem_inv_admission import check_fixture
from scripts.results_io import GATEMEM_DOMAINS, REPO, ensure_pinned_gatemem, load_config

COLUMNS = (
    "benchmark",
    "item",
    "kind",
    "what",
    "benchmark_label",
    "benchmark_targets",
    "context",
    "member_label",
    "member_targets_ok",
    "member_comment",
)
VIOLATION_KINDS = {"privacy": "access control", "safety": "active forgetting"}


def check_out_dir(out: Path) -> None:
    """Sheets go under the repository's .engram/ or outside the repository."""
    resolved = out.resolve()
    scratch = (REPO / ".engram").resolve()
    inside_repo = resolved == REPO.resolve() or REPO.resolve() in resolved.parents
    if inside_repo and scratch != resolved and scratch not in resolved.parents:
        raise ValueError(
            f"{out} is inside the repository but not under {scratch}: "
            "the sheets hold benchmark content"
        )


def sample_per_kind(
    checkpoints: Sequence[Mapping[str, Any]], per_kind: int, seed: int
) -> list[Mapping[str, Any]]:
    """A seeded sample of `per_kind` checkpoints of each violation kind, sorted by kind and id."""
    rng = np.random.default_rng(seed)
    drawn: list[Mapping[str, Any]] = []
    for kind in sorted(VIOLATION_KINDS):
        mine = sorted(
            (c for c in checkpoints if c["query_type"] == kind), key=lambda c: c["checkpoint_id"]
        )
        chosen = rng.choice(len(mine), size=min(per_kind, len(mine)), replace=False)
        drawn.extend(mine[int(i)] for i in sorted(chosen))
    return drawn


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def gatemem_rows(spec: Mapping[str, Any], seed: int) -> list[tuple[dict[str, str], str]]:
    """The sampled checkpoints as sheet rows, each with its context file's text."""
    data = REPO / str(spec["data"])
    ensure_pinned_gatemem(data, REPO / str(spec["manifest"]), fetch=bool(spec["fetch"]))
    checkpoints: list[dict[str, Any]] = []
    episodes: dict[str, dict[str, Any]] = {}
    for domain in GATEMEM_DOMAINS:
        for c in _read_jsonl(data / domain / "checkpoints.jsonl"):
            checkpoints.append({**c, "domain": domain})
        for e in _read_jsonl(data / domain / "episodes.jsonl"):
            episodes[e["episode_id"]] = e
    rows = []
    for drawn in sample_per_kind(checkpoints, int(spec["per_kind"]), seed):
        c = dict(drawn)
        asker = c["asker"]
        rows.append(
            (
                {
                    "benchmark": "gatemem",
                    "item": f"gatemem/{c['checkpoint_id']}",
                    "kind": VIOLATION_KINDS[c["query_type"]],
                    "what": f"{asker['principal_id']} ({asker['role']}) asks at "
                    f"{c['as_of_turn_id']}: {c['query_text']}",
                    "benchmark_label": c["expected_action"],
                    "benchmark_targets": " | ".join(c.get("leak_targets") or []),
                },
                gatemem_context(c, episodes[c["episode_id"]]),
            )
        )
    return rows


def gatemem_context(checkpoint: Mapping[str, Any], episode: Mapping[str, Any]) -> str:
    """The checkpoint, its labels, the episode's people and every turn up to the as-of turn."""
    lines = [
        f"# {checkpoint['checkpoint_id']}",
        "",
        f"- Asker: {checkpoint['asker']['principal_id']} ({checkpoint['asker']['role']})",
        f"- Question, as of {checkpoint['as_of_turn_id']}: {checkpoint['query_text']}",
        f"- Benchmark label (expected action): {checkpoint['expected_action']}",
        f"- Leak targets: {json.dumps(checkpoint.get('leak_targets') or [], ensure_ascii=False)}",
        f"- Judge spec: {json.dumps(checkpoint.get('judge_spec'), ensure_ascii=False)}",
        "",
        "## Entities",
        "",
        "```json",
        json.dumps(episode.get("entities", {}), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Turns up to the as-of turn",
        "",
    ]
    for turn in episode["turns"]:
        speaker = turn["speaker"]
        lines.append(
            f"- {turn['turn_id']} {turn.get('timestamp', '')} "
            f"{speaker['principal_id']} ({speaker['role']}): {turn['text']}"
        )
        if turn["turn_id"] == checkpoint["as_of_turn_id"]:
            break
    return "\n".join(lines) + "\n"


def mem_inv_rows(spec: Mapping[str, Any]) -> list[tuple[dict[str, str], str]]:
    """Every vendored case (or a seeded `per_benchmark` of them, when there are more)."""
    fixtures = REPO / str(spec["fixtures"])
    check_fixture(fixtures, str(spec["cases"]))
    cases = _read_jsonl(fixtures / str(spec["cases"]))
    if len(cases) > int(spec["per_benchmark"]):
        raise ValueError("MEM-INV-Bench's full set has more cases than the audit takes")
    rows = []
    for c in sorted(cases, key=lambda c: c["case_id"]):
        attack = c["family"] == "attack"
        keys = (
            f"poisoned value: {c['evil']} | legitimate value: {c['good']}"
            if attack
            else f"legitimate value: {c['value']}"
        )
        rows.append(
            (
                {
                    "benchmark": "mem-inv-bench",
                    "item": f"mem-inv-bench/{c['case_id']}",
                    "kind": f"attack/{c['channel']}" if attack else "benign",
                    "what": c["task"],
                    "benchmark_label": c["family"],
                    "benchmark_targets": keys,
                },
                mem_inv_context(c, keys),
            )
        )
    return rows


def mem_inv_context(case: Mapping[str, Any], keys: str) -> str:
    lines = [
        f"# {case['case_id']}",
        "",
        f"- Task: {case['task']}",
        f"- Benchmark label: {case['family']}, laundering channel {case['channel']}",
        f"- Scoring keys: {keys}",
        f"- Action tool: {case['tool']}",
        "",
        "## Memory the agent reads",
        "",
    ]
    for e in case["memory"]:
        lines.append(f"- {e['entry_id']} via {e['channel']}: {e['text']}")
    return "\n".join(lines) + "\n"


def write_kit(config: Mapping[str, Any], out: Path) -> list[Path]:
    """Every benchmark's sheets (one per member) and context files; the sheets written, in order."""
    check_out_dir(out)
    seed = int(config["seed"])
    members = [str(m) for m in config["members"]]
    benchmarks: dict[str, list[tuple[dict[str, str], str]]] = {}
    if config.get("gatemem"):
        benchmarks["gatemem"] = gatemem_rows(config["gatemem"], seed)
    if config.get("mem-inv-bench"):
        benchmarks["mem-inv-bench"] = mem_inv_rows(config["mem-inv-bench"])
    sheets = [out / f"{b}-{m}.csv" for b in benchmarks for m in members]
    existing = [p for p in sheets if p.exists()]
    if existing:
        raise FileExistsError(f"sheets exist and may be filled: {[str(p) for p in existing]}")
    for benchmark, rows in benchmarks.items():
        context_dir = out / "context" / benchmark
        context_dir.mkdir(parents=True, exist_ok=True)
        full_rows = []
        for n, (row, context) in enumerate(rows, start=1):
            name = f"context/{benchmark}/{n:02d}.md"
            (out / name).write_text(context, encoding="utf-8", newline="\n")
            full_rows.append(
                {
                    **row,
                    "context": name,
                    "member_label": "",
                    "member_targets_ok": "",
                    "member_comment": "",
                }
            )
        for member in members:
            with (out / f"{benchmark}-{member}.csv").open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
                writer.writeheader()
                writer.writerows(full_rows)
    return sheets


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    out = args.out if args.out is not None else REPO / str(config["out"])
    for sheet in write_kit(config, out):
        print(f"label-audit: wrote {sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
