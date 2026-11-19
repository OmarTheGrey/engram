"""The clock problem on LongMemEval (card B6): what the plane's read filter hides, per question.

Usage:
    uv run python research/scripts/h2_longmemeval_ttl.py \\
        --config research/configs/h2-longmemeval-ttl.json \\
        --out research/results/h2-longmemeval-ttl.json
    uv run python research/scripts/h2_longmemeval_ttl.py \\
        --config research/configs/h2-longmemeval-ttl.json --fetch-only

Card L2 found that under preset medium's 90-day ttl part of LongMemEval's S
histories is past its validity when the plane reads it
(docs/log/2026-11-19-l2-finding-medium-ttl.md), so C5 hides those turns for a
reason that is the date and not governance. This script measures it per
question for the lead's choice of clock and preset (card B6, H2's primary
test is C2 minus C5 at medium on LongMemEval).

The measurement is TypeScript, reached through
packages/runner/scripts/longmemeval-clock.ts and never reimplemented here:
for each question and preset, every turn crosses Plane.write as card B5
writes it, and the user's read with no query text, at each clock, returns
what the plane's own read filter admits. The clocks: `read_time`, B5's read
time (the question's date, or the last turn's when a session is dated
later); `last_session`, the history's last turn; `real_time`, the config's
fixed instant, standing for a live run's wall clock. The benchmark's evidence
labels (`has_answer` turns and `answer_session_ids` sessions) are read only
afterwards, to count which hidden turns hold the answer; they reach no
write, read or prompt.

The data file is card L2's: checked against its pinned sha256 and fetched
into .engram/upstream when missing and allowed (data only, never a model)
by research/scripts/h3_fault_set.py's ensure_pinned_file; `--fetch-only`
does only that, for `make run CONFIG=research/configs/h2-longmemeval-*.json
COUNT=1`. The questions are split across worker processes as card L2's
script splits them; the bytes do not depend on the worker count
(ENGRAM_RESEARCH_WORKERS). Only counts, question ids and their categories,
and the sha256 of the joined per-question rows are committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from scripts.h3_fault_set import ensure_pinned_file, split
from scripts.results_io import REPO, load_config, run_node, sha256_file, workers, write_result

ENTRY = "packages/runner/scripts/longmemeval-clock.ts"
CLOCKS = ("read_time", "last_session", "real_time")
MAX_PARTS = 16
DAY = 86_400

CLOCK_MEANING = {
    "read_time": "B5's read time (packages/bench/src/longmemeval/plane.ts readTime): the "
    "question's date, or the last turn's time when a session is dated after the question",
    "last_session": "the time of the history's last turn",
    "real_time": "the config's fixed instant, standing for the wall clock of a live run, which "
    "reads later still, so a live run hides at least this much",
}


def clock_rows(data: Path, config: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Every question's row from the entry point, run over parts in parallel, in question order."""
    questions = json.loads(data.read_text(encoding="utf-8"))
    ranges = split(len(questions), workers(min(len(questions), MAX_PARTS)))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for part, (lo, hi) in enumerate(ranges):
            with (root / f"part-{part}.jsonl").open("w", encoding="utf-8", newline="\n") as f:
                for q in questions[lo:hi]:
                    f.write(json.dumps(q, ensure_ascii=False) + "\n")
        del questions

        def run(part: int) -> list[dict[str, Any]]:
            out = root / f"rows-{part}.jsonl"
            run_node(
                [
                    ENTRY,
                    "--data",
                    str(root / f"part-{part}.jsonl"),
                    "--presets",
                    ",".join(str(p) for p in config["presets"]),
                    "--real-time",
                    str(config["real_time"]),
                    "--out",
                    str(out),
                ]
            )
            with out.open(encoding="utf-8") as f:
                return [json.loads(line) for line in f if line.strip()]

        with ThreadPoolExecutor(len(ranges)) as pool:
            parts = list(pool.map(run, range(len(ranges))))
    return [row for part in parts for row in part]


def _share(n: int, of: int) -> float:
    return n / of if of else 0.0


def summarise_cell(rows: Sequence[Mapping[str, Any]], preset: str, clock: str) -> dict[str, Any]:
    """One preset at one clock: the turns hidden and the questions they touch, by category too."""
    cells = [(r, r["presets"][preset]["clocks"][clock]) for r in rows]
    hides = [r for r, c in cells if c["hidden"] > 0]
    loses = [r for r, c in cells if c["evidence_turns_hidden"] > 0]
    loses_all = [
        r
        for r, c in cells
        if r["evidence_turns"] > 0 and c["evidence_turns_hidden"] == r["evidence_turns"]
    ]
    loses_session = [r for r, c in cells if c["evidence_session_turns_hidden"] > 0]
    categories = sorted({str(r["category"]) for r in rows})

    def of(cat: str, group: Sequence[Mapping[str, Any]]) -> int:
        return sum(1 for r in group if r["category"] == cat)

    return {
        "hidden_turns": sum(int(c["hidden"]) for _, c in cells),
        "by_cause": {
            k: sum(int(c[k]) for _, c in cells)
            for k in ("expired", "outside_validity", "not_active")
        },
        "questions_with_hidden_turns": len(hides),
        "share_with_hidden_turns": _share(len(hides), len(rows)),
        "evidence_turns_hidden": sum(int(c["evidence_turns_hidden"]) for _, c in cells),
        "questions_losing_evidence": len(loses),
        "share_losing_evidence": _share(len(loses), len(rows)),
        "questions_losing_all_evidence": len(loses_all),
        "evidence_session_turns_hidden": sum(
            int(c["evidence_session_turns_hidden"]) for _, c in cells
        ),
        "questions_losing_evidence_session_turns": len(loses_session),
        "oldest_turn_age_days_max": max(float(c["oldest_age_seconds"]) for _, c in cells) / DAY,
        "by_category": {
            cat: {
                "questions": of(cat, rows),
                "with_hidden_turns": of(cat, hides),
                "losing_evidence": of(cat, loses),
                "losing_evidence_session_turns": of(cat, loses_session),
            }
            for cat in categories
        },
    }


def per_question(
    rows: Sequence[Mapping[str, Any]], preset: str, clock: str
) -> list[dict[str, Any]]:
    """The questions with a hidden turn at one preset and clock, by id: what each loses."""
    out = []
    for r in rows:
        c = r["presets"][preset]["clocks"][clock]
        if c["hidden"] == 0:
            continue
        out.append(
            {
                "question_id": r["question_id"],
                "category": r["category"],
                "turns": r["turns"],
                "hidden_turns": c["hidden"],
                "evidence_turns": r["evidence_turns"],
                "evidence_turns_hidden": c["evidence_turns_hidden"],
                "evidence_session_turns": r["evidence_session_turns"],
                "evidence_session_turns_hidden": c["evidence_session_turns_hidden"],
                "oldest_turn_age_days": float(c["oldest_age_seconds"]) / DAY,
            }
        )
    return sorted(out, key=lambda q: str(q["question_id"]))


def l2_check(rows: Sequence[Mapping[str, Any]], l2_path: Path) -> dict[str, Any]:
    """Card L2's count (its generator's isExpired at B5's read time) beside the plane's."""
    l2 = json.loads(l2_path.read_text(encoding="utf-8"))["base"]["past_medium_ttl"]
    cells = [r["presets"]["medium"]["clocks"]["read_time"] for r in rows]
    mine = {
        "turns": sum(int(c["expired"]) for c in cells),
        "questions": sum(1 for c in cells if c["expired"] > 0),
    }
    return {
        "file": str(l2_path.relative_to(REPO)).replace("\\", "/"),
        "sha256": sha256_file(l2_path),
        "l2_past_medium_ttl": l2,
        "plane_read_expired": mine,
        "equal": mine == {"turns": int(l2["turns"]), "questions": int(l2["questions"])},
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = dict(config["data"])
    path = ensure_pinned_file(data, fetch=bool(config.get("fetch", False)))
    rows = clock_rows(path, config)
    joined = "".join(json.dumps(r, sort_keys=True) + "\n" for r in rows)
    presets = [str(p) for p in config["presets"]]
    primary = config["primary"]
    writes: dict[str, dict[str, int]] = {}
    for p in presets:
        tally: dict[str, int] = {}
        for r in rows:
            for d, n in r["presets"][p]["writes"].items():
                tally[d] = tally.get(d, 0) + int(n)
        writes[p] = dict(sorted(tally.items()))
    out: dict[str, Any] = {
        "name": config["name"],
        "hypothesis": "H2",
        "benchmark": "longmemeval",
        "data": {k: data[k] for k in ("dataset", "revision", "file", "sha256")},
        "entry": ENTRY,
        "real_time": config["real_time"],
        "clocks": CLOCK_MEANING,
        "questions": len(rows),
        "turns": sum(int(r["turns"]) for r in rows),
        "evidence_turns": sum(int(r["evidence_turns"]) for r in rows),
        "evidence_session_turns": sum(int(r["evidence_session_turns"]) for r in rows),
        "questions_without_evidence_turns": sum(1 for r in rows if r["evidence_turns"] == 0),
        "writes": writes,
        "by_preset": {p: {c: summarise_cell(rows, p, c) for c in CLOCKS} for p in presets},
        "primary": {
            "preset": primary["preset"],
            "clock": primary["clock"],
            "questions": per_question(rows, str(primary["preset"]), str(primary["clock"])),
        },
        "rows_sha256": hashlib.sha256(joined.encode("utf-8")).hexdigest(),
    }
    if "medium" in presets and config.get("l2"):
        out["l2_check"] = l2_check(rows, REPO / str(config["l2"]))
    return out


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--fetch-only", action="store_true")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if args.fetch_only:
        print(ensure_pinned_file(dict(config["data"]), fetch=bool(config.get("fetch", False))))
        return 0
    if args.out is None:
        parser.error("--out is required unless --fetch-only")
    write_result(args.out, compute(config))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
