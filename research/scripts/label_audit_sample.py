"""The label-audit sample: blind sheets for two members, then a key check, filled in locally.

Usage:
    uv run python research/scripts/label_audit_sample.py \\
        --config research/configs/label-audit.json [--out .engram/audit]
    uv run python research/scripts/label_audit_sample.py \\
        --config research/configs/label-audit.json --phase 2 --member <name> [--out ...]

Plan decision 9 of docs/tasks/prereg-v1-plan.md (ADR 0015; pre-registration,
Benchmarks: "before any run, 50 items per benchmark are label-audited by two
members and the disagreement rate is reported"), redesigned after the
review of PR 4's part A (P4A-3) so that no member reads a benchmark's label
before giving their own.

The draw (`draw`), seeded by the config, is the same for every call:

- GateMem: from the pinned full set (checked against the pinned hashes,
  fetched into .engram/upstream when the config allows), `per_kind`
  access-control and `per_kind` active-forgetting checkpoints, the items
  H1's violation rate is computed on, put in one seeded order that mixes
  the two kinds, and named G01, G02, ...;
- MEM-INV-Bench: every case of the vendored full set (38, fewer than 50),
  checked against its manifest, in a seeded order, named M01, M02, ....

Phase 1 (blind) writes, per benchmark and member, `<out>/<benchmark>-<member>.csv`
with a reference, the benchmark, the item's context file and empty columns
for the member's own label and a comment, and one context file per item
under `<out>/context/<benchmark>/`: what an agent sees (the question and who
asks it, the episode's people and every turn up to the question; the task
and the memory), and nothing else: no checkpoint id, kind, expected action,
leak target, judge spec, family, laundering channel or scoring value.
Phase 2 (key check), for one member, is refused until that member's phase-1
sheets are complete; it writes `<out>/<benchmark>-<member>-keys.csv` with
each item's scoring keys (GateMem's leak targets and not_include patterns;
MEM-INV-Bench's poisoned and legitimate values) and a yes or no column.

The sheets hold benchmark content, so they are written only under `.engram/`
(which git ignores) or outside the repository, and an existing sheet is
never overwritten. research/scripts/label_audit_agreement.py reads the
filled sheets and takes the benchmark labels from this draw, never from a
sheet. docs/research/label-audit.md is the how-to. No model is called.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from scripts.h1_mem_inv_admission import check_fixture
from scripts.results_io import GATEMEM_DOMAINS, REPO, ensure_pinned_gatemem, load_config

PHASE_1_COLUMNS = ("ref", "benchmark", "context", "member_label", "member_comment")
PHASE_2_COLUMNS = ("ref", "benchmark", "scoring_keys", "member_keys_ok", "member_comment")
VIOLATION_KINDS = ("privacy", "safety")
VOCABULARY = {
    "gatemem": ("answer", "answer_redacted", "refuse", "no_memory"),
    "mem-inv-bench": ("attack", "legit"),
}
# Where an item's content begins in its context file; above it, only the reference and who asks.
CONTENT_MARK = "## Content"


@dataclass(frozen=True)
class AuditItem:
    """One sampled item: what the members see (`context_text`) and what they must not (the rest)."""

    benchmark: str
    ref: str
    item: str
    kind: str
    label: str
    keys: tuple[str, ...]
    context: str
    context_text: str


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
    for kind in VIOLATION_KINDS:
        mine = sorted(
            (c for c in checkpoints if c["query_type"] == kind), key=lambda c: c["checkpoint_id"]
        )
        chosen = rng.choice(len(mine), size=min(per_kind, len(mine)), replace=False)
        drawn.extend(mine[int(i)] for i in sorted(chosen))
    return drawn


def _order(n: int, seed: int, stream: int) -> list[int]:
    """A seeded permutation of range(n); `stream` keeps each benchmark's order apart."""
    return [int(i) for i in np.random.default_rng([seed, stream]).permutation(n)]


def _gatemem_context(ref: str, checkpoint: Mapping[str, Any], episode: Mapping[str, Any]) -> str:
    asker = checkpoint["asker"]
    lines = [
        f"# {ref}",
        "",
        f"- Who asks: {asker['principal_id']} ({asker['role']})",
        f"- Asked as of turn {checkpoint['as_of_turn_id']}",
        "",
        CONTENT_MARK,
        "",
        f"Question: {checkpoint['query_text']}",
        "",
        "People and relationships:",
        "",
        "```json",
        json.dumps(episode.get("entities", {}), indent=2, ensure_ascii=False),
        "```",
        "",
        "Turns up to the question:",
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


def gatemem_items(
    checkpoints: Sequence[Mapping[str, Any]],
    episodes: Mapping[str, Mapping[str, Any]],
    per_kind: int,
    seed: int,
) -> list[AuditItem]:
    """The GateMem sample in one seeded order mixing both kinds, named G01, G02, ...."""
    drawn = sample_per_kind(checkpoints, per_kind, seed)
    items = []
    for n, i in enumerate(_order(len(drawn), seed, 1), start=1):
        c = drawn[i]
        ref = f"G{n:02d}"
        spec = c.get("judge_spec") or {}
        keys = list(
            dict.fromkeys([*(c.get("leak_targets") or []), *(spec.get("not_include") or [])])
        )
        items.append(
            AuditItem(
                benchmark="gatemem",
                ref=ref,
                item=f"gatemem/{c['checkpoint_id']}",
                kind=str(c["query_type"]),
                label=str(c["expected_action"]),
                keys=tuple(str(k) for k in keys),
                context=f"context/gatemem/{ref}.md",
                context_text=_gatemem_context(ref, c, episodes[c["episode_id"]]),
            )
        )
    return items


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def _mem_inv_context(ref: str, case: Mapping[str, Any]) -> str:
    lines = [f"# {ref}", "", CONTENT_MARK, "", f"Task: {case['task']}", "", "Memory:", ""]
    for e in case["memory"]:
        derived = f", derived from {', '.join(e['derived_from'])}" if e.get("derived_from") else ""
        lines.append(f"- {e['entry_id']} via {e['channel']}{derived}: {e['text']}")
    return "\n".join(lines) + "\n"


def mem_inv_items(spec: Mapping[str, Any], seed: int) -> list[AuditItem]:
    """Every vendored case in a seeded order, named M01, M02, ...."""
    fixtures = REPO / str(spec["fixtures"])
    check_fixture(fixtures, str(spec["cases"]))
    cases = sorted(_read_jsonl(fixtures / str(spec["cases"])), key=lambda c: c["case_id"])
    if len(cases) > int(spec.get("per_benchmark", len(cases))):
        raise ValueError("MEM-INV-Bench's full set has more cases than the audit takes")
    items = []
    for n, i in enumerate(_order(len(cases), seed, 2), start=1):
        c = cases[i]
        ref = f"M{n:02d}"
        attack = c["family"] == "attack"
        keys = (c["evil"], c["good"]) if attack else (c["value"],)
        items.append(
            AuditItem(
                benchmark="mem-inv-bench",
                ref=ref,
                item=f"mem-inv-bench/{c['case_id']}",
                kind=f"attack/{c['channel']}" if attack else "benign",
                label=str(c["family"]),
                keys=tuple(str(k) for k in keys),
                context=f"context/mem-inv-bench/{ref}.md",
                context_text=_mem_inv_context(ref, c),
            )
        )
    return items


def draw(config: Mapping[str, Any]) -> dict[str, list[AuditItem]]:
    """The config's seeded draw from the pinned data, the same on every call."""
    seed = int(config["seed"])
    out: dict[str, list[AuditItem]] = {}
    spec = config.get("gatemem")
    if spec:
        data = REPO / str(spec["data"])
        ensure_pinned_gatemem(data, REPO / str(spec["manifest"]), fetch=bool(spec["fetch"]))
        checkpoints: list[dict[str, Any]] = []
        episodes: dict[str, dict[str, Any]] = {}
        for domain in GATEMEM_DOMAINS:
            checkpoints.extend(_read_jsonl(data / domain / "checkpoints.jsonl"))
            for e in _read_jsonl(data / domain / "episodes.jsonl"):
                episodes[e["episode_id"]] = e
        out["gatemem"] = gatemem_items(checkpoints, episodes, int(spec["per_kind"]), seed)
    if config.get("mem-inv-bench"):
        out["mem-inv-bench"] = mem_inv_items(config["mem-inv-bench"], seed)
    return out


def _write_sheet(path: Path, columns: Sequence[str], rows: Sequence[Mapping[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_phase_1(
    drawn: Mapping[str, Sequence[AuditItem]], members: Sequence[str], out: Path
) -> list[Path]:
    """Every benchmark's blind sheets (one per member) and context files; the sheets, in order."""
    check_out_dir(out)
    sheets = [out / f"{b}-{m}.csv" for b in drawn for m in members]
    existing = [str(p) for p in sheets if p.exists()]
    if existing:
        raise FileExistsError(f"sheets exist and may be filled: {existing}")
    for benchmark, items in drawn.items():
        (out / "context" / benchmark).mkdir(parents=True, exist_ok=True)
        for item in items:
            (out / item.context).write_text(item.context_text, encoding="utf-8", newline="\n")
        rows = [
            {
                "ref": i.ref,
                "benchmark": benchmark,
                "context": i.context,
                "member_label": "",
                "member_comment": "",
            }
            for i in items
        ]
        for member in members:
            _write_sheet(out / f"{benchmark}-{member}.csv", PHASE_1_COLUMNS, rows)
    return sheets


def phase_1_labels(path: Path, benchmark: str, refs: Sequence[str]) -> dict[str, str]:
    """A member's filled phase-1 labels by reference; refuses a sheet that is not complete."""
    with path.open(encoding="utf-8", newline="") as f:
        rows = {row["ref"]: row for row in csv.DictReader(f)}
    if sorted(rows) != sorted(refs):
        raise ValueError(f"{path.name}: the sheet must hold the same items as the draw")
    allowed = VOCABULARY[benchmark]
    labels = {ref: rows[ref]["member_label"].strip().lower() for ref in refs}
    bad = [f"{ref}: {v!r}" for ref, v in labels.items() if v not in allowed]
    if bad:
        raise ValueError(f"{path.name}: member_label must be one of {list(allowed)}; not {bad}")
    return labels


def write_phase_2(drawn: Mapping[str, Sequence[AuditItem]], member: str, out: Path) -> list[Path]:
    """One member's key-check sheets, refused until that member's phase-1 sheets are complete."""
    check_out_dir(out)
    for benchmark, items in drawn.items():
        path = out / f"{benchmark}-{member}.csv"
        if not path.exists():
            raise ValueError(f"phase 1 is not done: {path} is missing")
        try:
            phase_1_labels(path, benchmark, [i.ref for i in items])
        except ValueError as e:
            raise ValueError(f"phase 1 is not complete: {e}") from e
    sheets = [out / f"{b}-{member}-keys.csv" for b in drawn]
    existing = [str(p) for p in sheets if p.exists()]
    if existing:
        raise FileExistsError(f"key sheets exist and may be filled: {existing}")
    for benchmark, items in drawn.items():
        rows = [
            {
                "ref": i.ref,
                "benchmark": benchmark,
                "scoring_keys": " | ".join(i.keys),
                "member_keys_ok": "",
                "member_comment": "",
            }
            for i in items
        ]
        _write_sheet(out / f"{benchmark}-{member}-keys.csv", PHASE_2_COLUMNS, rows)
    return sheets


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--phase", type=int, choices=(1, 2), default=1)
    parser.add_argument("--member", help="phase 2: the member whose key sheets to write")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    out = args.out if args.out is not None else REPO / str(config["out"])
    drawn = draw(config)
    if args.phase == 1:
        written = write_phase_1(drawn, [str(m) for m in config["members"]], out)
    else:
        if not args.member:
            parser.error("--phase 2 needs --member")
        written = write_phase_2(drawn, str(args.member), out)
    for sheet in written:
        print(f"label-audit: wrote {sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
