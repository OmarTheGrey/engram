"""Candidate frontier axes, offline (card RV8, RV-DES-2): what each axis value admits and hides.

Usage:
    uv run python research/scripts/frontier_axes.py \\
        --config research/configs/frontier-axes.json --out research/results/frontier-axes.json

H2's knee and Gate D's two policy levels need a strictness axis the benchmarks
exercise, and the three presets admit and deny the same items on GateMem
(research/results/h1-gatemem-reach.json) and differ on LongMemEval only by
their ttl (research/results/h2-longmemeval-ttl.json). This script measures,
with no model, how candidate axes move what the plane admits: grant
honouring, the read matrix's width, the person-scope episodic budget and
ttl, and (an extra) whether model content is admitted. Each variant is preset
medium with fields set (`variants` in the config), validated by core's own
policy loader.

The measurement is TypeScript, reached through
packages/runner/scripts/frontier-axes.ts and never reimplemented here: on
GateMem every checkpoint's reach (gatemem-reach.ts reachOf, the C5 probe's
ingestion and the asker's read with no query text), then the scorer's
patterns in reach (scoreReach) or, at a utility checkpoint, the judge spec's
`include` patterns in reach; on LongMemEval every question's write phase and
read at B5's read time (longmemeval-clock.ts clockRowFor). The labels are read
only after the plane has decided.

Per variant and benchmark the result gives the items denied at write, the
items hidden at read (absolute, and against the baseline: turns hidden that
the baseline shows, and turns shown that it hides), and the questions or
checkpoints affected; per axis, whether it is `flat` on the benchmark: every
item's write decisions and read identical to the baseline's at every value.
Only counts, ids and hashes are committed. The data are checked against their
pins and fetched when missing (data only). The bytes do not depend on the
worker count (ENGRAM_RESEARCH_WORKERS).
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
from scripts.results_io import (
    GATEMEM_DOMAINS,
    REPO,
    ensure_pinned_gatemem,
    load_config,
    run_node,
    workers,
    write_result,
)

ENTRY = "packages/runner/scripts/frontier-axes.ts"
MAX_PARTS = 16
KINDS = {"privacy": "access", "safety": "forgetting", "utility": "utility"}


def variant_specs(config: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The variants as the entry point takes them; the baseline must be one of them."""
    specs = [{k: v[k] for k in ("name", "base", "set") if k in v} for v in config["variants"]]
    names = [s["name"] for s in specs]
    if config["baseline"] not in names:
        raise ValueError(f"the baseline {config['baseline']} is not a variant")
    if len(set(names)) != len(names):
        raise ValueError("two variants share a name")
    return specs


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def _run_parts(
    benchmark: str, parts: Sequence[Path], variants: Path, extra: Sequence[str], root: Path
) -> list[dict[str, Any]]:
    def run(i: int) -> list[dict[str, Any]]:
        out = root / f"rows-{i}.jsonl"
        args = [
            ENTRY,
            "--benchmark",
            benchmark,
            "--data",
            str(parts[i]),
            "--variants",
            str(variants),
        ]
        run_node([*args, *extra, "--out", str(out)])
        return _read_jsonl(out)

    with ThreadPoolExecutor(len(parts)) as pool:
        done = list(pool.map(run, range(len(parts))))
    return [row for part in done for row in part]


def gatemem_rows(data: Path, variants: Path, root: Path) -> list[dict[str, Any]]:
    """Every checkpoint's row, the checkpoints split across parts, in domain and id order."""
    jobs: list[tuple[str, list[str]]] = []
    for domain in GATEMEM_DOMAINS:
        lines = sorted(
            (data / domain / "checkpoints.jsonl").read_text(encoding="utf-8").splitlines(),
            key=lambda line: json.loads(line)["checkpoint_id"] if line else "",
        )
        jobs.extend((domain, [ln]) for ln in lines if ln)
    ranges = split(len(jobs), workers(min(len(jobs), MAX_PARTS)))
    parts = []
    for i, (lo, hi) in enumerate(ranges):
        part = root / f"gatemem-{i}"
        for domain in GATEMEM_DOMAINS:
            mine = [ln for d, chunk in jobs[lo:hi] if d == domain for ln in chunk]
            if not mine:
                continue
            (part / domain).mkdir(parents=True, exist_ok=True)
            (part / domain / "episodes.jsonl").write_bytes(
                (data / domain / "episodes.jsonl").read_bytes()
            )
            (part / domain / "checkpoints.jsonl").write_text(
                "\n".join(mine) + "\n", encoding="utf-8"
            )
        parts.append(part)
    rows = _run_parts("gatemem", parts, variants, [], root)
    return sorted(rows, key=lambda r: (str(r["domain"]), str(r["checkpoint_id"])))


def longmemeval_rows(
    data: Path, variants: Path, real_time: str, root: Path
) -> list[dict[str, Any]]:
    questions = json.loads(data.read_text(encoding="utf-8"))
    ranges = split(len(questions), workers(min(len(questions), MAX_PARTS)))
    parts = []
    for i, (lo, hi) in enumerate(ranges):
        path = root / f"lme-{i}.jsonl"
        with path.open("w", encoding="utf-8", newline="\n") as f:
            for q in questions[lo:hi]:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
        parts.append(path)
    del questions
    return _run_parts("longmemeval", parts, variants, ["--real-time", real_time], root)


def _rows_sha(rows: Sequence[Mapping[str, Any]]) -> str:
    joined = "".join(json.dumps(r, sort_keys=True) + "\n" for r in rows)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def summarise_gatemem(
    rows: Sequence[Mapping[str, Any]], names: Sequence[str], baseline: str
) -> dict[str, Any]:
    """Per variant: denials, readable turns, the change against the baseline, per kind."""
    out: dict[str, Any] = {}
    for name in names:
        kinds: dict[str, Any] = {}
        for qt, kind in KINDS.items():
            mine = [r for r in rows if r["query_type"] == qt]
            cells = [(r["variants"][name], r["variants"][baseline]) for r in mine]

            def diff(c: Mapping[str, Any], b: Mapping[str, Any]) -> tuple[int, int]:
                hidden = sum(
                    1
                    for x, y in zip(c["readable"], b["readable"], strict=True)
                    if y == "1" and x == "0"
                )
                shown = sum(
                    1
                    for x, y in zip(c["readable"], b["readable"], strict=True)
                    if y == "0" and x == "1"
                )
                return hidden, shown

            diffs = [diff(c, b) for c, b in cells]
            k: dict[str, Any] = {
                "checkpoints": len(mine),
                "turn_writes": sum(len(c["readable"]) for c, _ in cells),
                "denied_writes": sum(int(c["denied_writes"]) for c, _ in cells),
                "checkpoints_with_denied_writes": sum(
                    1 for c, _ in cells if c["denied_writes"] > 0
                ),
                "readable_turns": sum(c["readable"].count("1") for c, _ in cells),
                "readable_via_grant": sum(int(c["readable_granted"]) for c, _ in cells),
                "hidden_vs_baseline": sum(h for h, _ in diffs),
                "shown_vs_baseline": sum(s for _, s in diffs),
                "checkpoints_changed": sum(
                    1
                    for (c, b), (h, s) in zip(cells, diffs, strict=True)
                    if h or s or c["denied_writes"] != b["denied_writes"]
                ),
            }
            if qt == "utility":
                k["with_every_include_in_reach"] = sum(
                    1 for c, _ in cells if c["include_reachable"] == c["include_patterns"]
                )
                k["losing_include_vs_baseline"] = sum(
                    1 for c, b in cells if c["include_reachable"] < b["include_reachable"]
                )
            else:
                k["with_leak_in_reach"] = sum(1 for c, _ in cells if c["context_leak"])
                k["leak_removed_vs_baseline"] = sum(
                    1 for c, b in cells if b["context_leak"] and not c["context_leak"]
                )
                k["leak_added_vs_baseline"] = sum(
                    1 for c, b in cells if c["context_leak"] and not b["context_leak"]
                )
            kinds[kind] = k
        out[name] = {
            "kinds": kinds,
            "denied_writes": sum(v["denied_writes"] for v in kinds.values()),
            "hidden_vs_baseline": sum(v["hidden_vs_baseline"] for v in kinds.values()),
            "shown_vs_baseline": sum(v["shown_vs_baseline"] for v in kinds.values()),
            "checkpoints_changed": sum(v["checkpoints_changed"] for v in kinds.values()),
            "identical_to_baseline": all(
                r["variants"][name] == r["variants"][baseline] for r in rows
            ),
        }
    return out


def summarise_longmemeval(
    rows: Sequence[Mapping[str, Any]], names: Sequence[str], baseline: str, clock: str
) -> dict[str, Any]:
    """Per variant at one clock: writes, hidden turns, evidence lost, against the baseline."""
    out: dict[str, Any] = {}
    for name in names:
        cells = [(r, r["presets"][name], r["presets"][baseline]) for r in rows]
        writes: dict[str, int] = {}
        for _, c, _ in cells:
            for d, n in c["writes"].items():
                writes[d] = writes.get(d, 0) + int(n)
        at = [(r, c["clocks"][clock], b["clocks"][clock]) for r, c, b in cells]
        out[name] = {
            "writes": dict(sorted(writes.items())),
            "denied_writes": sum(n for d, n in writes.items() if d != "allow"),
            "hidden_turns": sum(int(c["hidden"]) for _, c, _ in at),
            "by_cause": {
                k: sum(int(c[k]) for _, c, _ in at)
                for k in ("expired", "outside_validity", "not_active")
            },
            "hidden_vs_baseline": sum(
                max(0, int(c["hidden"]) - int(b["hidden"])) for _, c, b in at
            ),
            "shown_vs_baseline": sum(max(0, int(b["hidden"]) - int(c["hidden"])) for _, c, b in at),
            "questions_with_hidden_turns": sum(1 for _, c, _ in at if c["hidden"] > 0),
            "questions_losing_evidence": sum(1 for _, c, _ in at if c["evidence_turns_hidden"] > 0),
            "questions_losing_all_evidence": sum(
                1
                for r, c, _ in at
                if r["evidence_turns"] > 0 and c["evidence_turns_hidden"] == r["evidence_turns"]
            ),
            "questions_changed": sum(1 for _, c, b in cells if c != b),
            "questions_losing_evidence_vs_baseline": sum(
                1 for _, c, b in at if c["evidence_turns_hidden"] > b["evidence_turns_hidden"]
            ),
            "identical_to_baseline": all(c == b for _, c, b in cells),
        }
    return out


def axes_verdict(
    config: Mapping[str, Any], summaries: Mapping[str, Mapping[str, Any]]
) -> dict[str, Any]:
    """Per axis and benchmark: flat when every value's items equal the baseline's."""
    out: dict[str, Any] = {}
    for axis in config["axes"]:
        if axis == "baseline":
            continue
        names = [v["name"] for v in config["variants"] if v["axis"] == axis]
        out[axis] = {
            "meaning": config["axes"][axis],
            "values": {v["name"]: v["value"] for v in config["variants"] if v["axis"] == axis},
            **{
                b: {
                    "flat": all(s[n]["identical_to_baseline"] for n in names),
                    "values_that_move": [n for n in names if not s[n]["identical_to_baseline"]],
                }
                for b, s in sorted(summaries.items())
            },
        }
    return out


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    specs = variant_specs(config)
    names = [s["name"] for s in specs]
    baseline = str(config["baseline"])
    gm = config["gatemem"]
    gm_data = REPO / str(gm["data"])
    gm_commit = ensure_pinned_gatemem(gm_data, REPO / str(gm["manifest"]), fetch=bool(gm["fetch"]))
    lme = config["longmemeval"]
    lme_data = ensure_pinned_file(dict(lme["data"]), fetch=bool(lme["fetch"]))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        variants = root / "variants.json"
        variants.write_text(json.dumps(specs), encoding="utf-8")
        g_rows = gatemem_rows(gm_data, variants, root)
        l_rows = longmemeval_rows(lme_data, variants, str(lme["real_time"]), root)
    summaries = {
        "gatemem": summarise_gatemem(g_rows, names, baseline),
        "longmemeval": summarise_longmemeval(l_rows, names, baseline, str(lme["clock"])),
    }
    return {
        "name": config["name"],
        "hypothesis": "H2",
        "entry": ENTRY,
        "baseline": baseline,
        "variants": config["variants"],
        "gatemem": {
            "commit": gm_commit,
            "checkpoints": len(g_rows),
            "rows_sha256": _rows_sha(g_rows),
            "by_variant": summaries["gatemem"],
        },
        "longmemeval": {
            "data": {k: lme["data"][k] for k in ("dataset", "revision", "file", "sha256")},
            "clock": lme["clock"],
            "questions": len(l_rows),
            "rows_sha256": _rows_sha(l_rows),
            "by_variant": summaries["longmemeval"],
        },
        "axes": axes_verdict(config, summaries),
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
