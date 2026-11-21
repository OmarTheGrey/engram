"""Plane overhead (card X15): latency percentiles and query counts against bare node:sqlite.

Usage:
    uv run python research/scripts/perf_budget.py \\
        --config research/configs/perf-budget.json --out research/results/h2-perf-budget.json
    uv run python research/scripts/perf_budget.py \\
        --config research/configs/perf-budget.json --measure
    uv run python research/scripts/perf_budget.py \\
        --config research/configs/perf-budget.json --rerun [--fresh <samples.jsonl>]

Timings are not byte-stable, so the work is split in two (AGENTS.md rule 9).
The suite, packages/core/bench/plane-overhead.ts, times Plane.write and
Plane.read with tinybench on the fake and files adapters per store size and
preset, each cell on its own copy of a freshly populated store, beside a bare
node:sqlite baseline, and writes every raw sample in call order, every call's
query counts and each cell's starting log size to the samples file the config
names, which is committed. This script computes the result from those
committed samples, so `make test-repro` regenerates it byte for byte; it
calls no model and runs no suite in that mode.

`--measure` reruns the suite and replaces the committed samples (then the
result is regenerated from them). `--rerun` is the rerun check: it runs the
suite into a temporary file (or into `--fresh`, which it keeps, or reads
`--fresh` when that file exists) and passes when
- every cell's new median lies within the config's per-cell band of the
  committed median (`median_band` for plane cells, `baseline_band` for the
  bare node:sqlite cells, whose sub-millisecond medians move more),
- for each plane op, the geometric mean over its plane cells of the new to
  committed median ratios is at most the config's aggregate band, so a
  regression of every read cell by a factor the per-cell band admits still
  fails; this bound is one-sided, since the check exists to catch
  regressions and a faster run is not one (the per-cell bands stay
  two-sided: a cell that moves that far either way makes the measurement
  suspect),
- and every query count and every cell's starting log size is equal.
It refuses samples from another machine, Node version or tinybench version,
since timings are never compared across them.

Percentiles are linear interpolation between closest ranks (numpy's default,
Hyndman and Fan type 7) over each cell's samples.
"""

from __future__ import annotations

import argparse
import json
import math
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, run_node, sha256_file, write_result

ENTRY = "packages/core/bench/plane-overhead.ts"
Key = tuple[str, int, str, str]


def percentile(samples: Sequence[float], q: float) -> float:
    """The q-th percentile (0 to 100) of sorted samples, linear between closest ranks."""
    if not samples:
        raise ValueError("percentile of no samples")
    h = (len(samples) - 1) * q / 100
    lo = math.floor(h)
    hi = min(lo + 1, len(samples) - 1)
    return samples[lo] + (h - lo) * (samples[hi] - samples[lo])


def pname(q: float) -> str:
    """The field name of a percentile: p50, p99, p999."""
    return "p" + format(q, "g").replace(".", "")


def read_samples(
    path: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """The header, the population records and the cells of a samples file."""
    lines = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    if not lines or lines[0].get("record") != "header":
        raise ValueError(f"{path}: the first line is not the suite's header")
    populate = [r for r in lines[1:] if r.get("record") == "populate"]
    cells = [r for r in lines[1:] if r.get("record") == "cell"]
    if len(cells) + len(populate) != len(lines) - 1:
        raise ValueError(f"{path}: a line after the header is neither a cell nor a population")
    return lines[0], populate, cells


def key(cell: Mapping[str, Any]) -> Key:
    return (str(cell["store"]), int(cell["size"]), str(cell["preset"] or ""), str(cell["op"]))


def baseline_key(config: Mapping[str, Any], k: Key) -> Key:
    """The bare node:sqlite cell a plane cell is compared with (the config's `baseline_of`)."""
    return ("sqlite", k[1], "", str(config["baseline_of"][k[3]]["op"]))


def stats(cell: Mapping[str, Any], percentiles: Sequence[float]) -> dict[str, Any]:
    samples = sorted(float(s) for s in cell["samples_ms"])
    if len(samples) != cell["iterations"]:
        raise ValueError(f"{key(cell)}: {len(samples)} samples, not {cell['iterations']}")
    out: dict[str, Any] = {
        "store": cell["store"],
        "size": cell["size"],
        "preset": cell["preset"],
        "op": cell["op"],
        "n": len(samples),
        "mean_ms": sum(samples) / len(samples),
        "min_ms": samples[0],
        "max_ms": samples[-1],
        "queries": cell["queries"],
        "start": cell["start"],
    }
    for q in percentiles:
        out[f"{pname(q)}_ms"] = percentile(samples, q)
    return out


def check_header(header: Mapping[str, Any], config: Mapping[str, Any]) -> None:
    if header["suite"] != config["suite"]:
        raise ValueError(
            "the samples were measured with another suite block than the config's; "
            "rerun the suite (--measure)"
        )


def budget_rows(
    config: Mapping[str, Any], cells: Mapping[Key, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Each budget rule against the measurement: a limit and, if set, a multiple of the baseline."""
    rows = []
    for rule in config["budget"]:
        k = (str(rule["store"]), int(rule["size"]), str(rule["preset"]), str(rule["op"]))
        if k not in cells:
            raise ValueError(f"budget {rule['name']}: no cell {k}")
        stat = f"{rule['stat']}_ms"
        measured = cells[k][stat]
        base = cells[baseline_key(config, k)][stat]
        row: dict[str, Any] = {
            **rule,
            "measured_ms": measured,
            "baseline_ms": base,
            "ratio": measured / base,
        }
        met = True
        if "limit_ms" in rule:
            met = met and measured <= float(rule["limit_ms"])
        if "max_ratio" in rule:
            met = met and measured / base <= float(rule["max_ratio"])
        row["met"] = met
        rows.append(row)
    return rows


def build(config: Mapping[str, Any], samples_path: Path) -> dict[str, Any]:
    header, populate, raw = read_samples(samples_path)
    check_header(header, config)
    percentiles = [float(q) for q in config["percentiles"]]
    cells = {key(c): stats(c, percentiles) for c in raw}
    if len(cells) != len(raw):
        raise ValueError(f"{samples_path}: a cell appears twice")
    overhead = []
    for k, cell in sorted(cells.items()):
        if k[0] == "sqlite":
            continue
        base = cells[baseline_key(config, k)]
        row: dict[str, Any] = {
            "store": k[0],
            "size": k[1],
            "preset": k[2],
            "op": k[3],
            "baseline_op": base["op"],
            "p50_added_ms": cell["p50_ms"] - base["p50_ms"],
        }
        for q in percentiles:
            name = pname(q)
            row[f"{name}_ratio"] = cell[f"{name}_ms"] / base[f"{name}_ms"]
        overhead.append(row)
    return {
        "card": "X15",
        "hypothesis": config["hypothesis"],
        "filed_under": config["filed_under"],
        "samples": config["samples"],
        "samples_sha256": sha256_file(samples_path),
        "suite": header["suite"],
        "node": header["node"],
        "tinybench": header["tinybench"],
        "machine": header["machine"],
        "notes": config["notes"],
        "baseline_of": config["baseline_of"],
        "percentile_method": "linear interpolation between closest ranks (numpy default, type 7)",
        "cells": [cells[k] for k in sorted(cells)],
        "population": [
            {
                "store": p["store"],
                "size": p["size"],
                "seconds": p["ms"] / 1000,
                "mean_write_ms": p["ms"] / p["size"],
            }
            for p in sorted(populate, key=lambda p: (p["store"], p["size"]))
        ],
        "overhead": overhead,
        "budget": budget_rows(config, cells),
        "tolerance": config["tolerance"],
    }


def measure(config_path: Path, out: Path) -> None:
    run_node([ENTRY, "--config", str(config_path), "--out", str(out)])


def identity(header: Mapping[str, Any], keys: Sequence[str]) -> dict[str, Any]:
    """What must match for two runs to be compared: the machine, Node and tinybench."""
    out = {k: header["machine"][k] for k in keys}
    out["node"] = header["node"]
    out["tinybench"] = header["tinybench"]
    return out


def median_ratios(
    old: Mapping[Key, Mapping[str, Any]], new: Mapping[Key, Mapping[str, Any]]
) -> dict[Key, float]:
    return {
        k: percentile(sorted(new[k]["samples_ms"]), 50)
        / percentile(sorted(old[k]["samples_ms"]), 50)
        for k in sorted(old)
    }


def geometric_means(ratios: Mapping[Key, float]) -> dict[str, float]:
    """Per plane op, the geometric mean of its plane cells' median ratios."""
    by_op: dict[str, list[float]] = {}
    for k, r in ratios.items():
        if k[0] != "sqlite":
            by_op.setdefault(k[3], []).append(r)
    return {op: math.exp(sum(map(math.log, rs)) / len(rs)) for op, rs in sorted(by_op.items())}


def rerun_check(config: Mapping[str, Any], committed: Path, fresh: Path) -> list[str]:
    """The problems of a fresh run against the committed samples; empty when it passes."""
    old_header, _, old = read_samples(committed)
    new_header, _, new = read_samples(fresh)
    keys = config["tolerance"]["machine_keys"]
    a, b = identity(old_header, keys), identity(new_header, keys)
    problems = [
        f"{k} differs ({a[k]!r} committed, {b[k]!r} now): timings are not compared across "
        "machines, Node versions or tinybench versions"
        for k in a
        if a[k] != b[k]
    ]
    if problems:
        return problems
    band = float(config["tolerance"]["median_band"])
    base_band = float(config["tolerance"]["baseline_band"])
    aggregate = float(config["tolerance"]["aggregate_band"])
    old_cells = {key(c): c for c in old}
    new_cells = {key(c): c for c in new}
    if sorted(old_cells) != sorted(new_cells):
        return ["the fresh run's cells differ from the committed ones"]
    ratios = median_ratios(old_cells, new_cells)
    for ck, ratio in ratios.items():
        width = base_band if ck[0] == "sqlite" else band
        verdict = "ok" if 1 / width <= ratio <= width else "OUT"
        print(f"perf-budget: {verdict} {' '.join(map(str, ck))} median ratio {ratio:.3f}")
        if verdict != "ok":
            problems.append(f"{ck}: median moved by {ratio:.3f}, outside 1/{width} to {width}")
        for field in ("queries", "start"):
            if old_cells[ck][field] != new_cells[ck][field]:
                problems.append(
                    f"{ck}: {field} differ: {old_cells[ck][field]} then {new_cells[ck][field]}"
                )
    for op, g in geometric_means(ratios).items():
        verdict = "ok" if g <= aggregate else "OUT"
        print(f"perf-budget: {verdict} {op} geometric mean of median ratios {g:.3f}")
        if verdict != "ok":
            problems.append(
                f"{op}: the geometric mean of its median ratios is {g:.3f}, above {aggregate}"
            )
    return problems


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--out", type=Path, help="write the result computed from the committed samples"
    )
    mode.add_argument(
        "--measure", action="store_true", help="rerun the suite into the samples file"
    )
    mode.add_argument("--rerun", action="store_true", help="the rerun check against the samples")
    parser.add_argument("--fresh", type=Path, help="with --rerun: the fresh samples, kept or read")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    samples = REPO / str(config["samples"])
    if args.measure:
        measure(args.config, samples)
        return 0
    if args.rerun:
        with tempfile.TemporaryDirectory() as tmp:
            fresh = args.fresh or Path(tmp) / "samples.jsonl"
            if not fresh.exists():
                measure(args.config, fresh)
            problems = rerun_check(config, samples, fresh)
        for p in problems:
            print(f"perf-budget: FAIL {p}")
        print(f"perf-budget: rerun check {'failed' if problems else 'passed'}")
        return 1 if problems else 0
    write_result(args.out, build(config, samples))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
