"""H1 evidence: what C4's walk shows against C3's top 20 on GateMem, per checkpoint.

Usage:
    uv run python research/scripts/h1_c4_walk.py \\
        --config research/configs/h1-c4-walk.json \\
        --out research/results/h1-c4-walk.json

C4 on GateMem (ADR 0031, decision 4) walks the shared ranking until it has
passed the items C5 returns and shows every item it walked past, allowed and
denied; C3 (and C2) show the ranking's top `read_limit` items. With each
checkpoint's own question as the query, for every checkpoint of GateMem's
pinned full set, under the preset C5 enforces, this counts:

- how many items C3, C4 and C5 show, and C4's allowed and denied items
  (C4's allowed items equal C5's list by construction; the count confirms it);
- C4's list length distribution, as packages/runner/scripts/c4-walk-lengths.ts
  printed it;
- checkpoints where C4 shows fewer items than C3, and where C4 shows nothing
  while C3 has candidates (no candidate is admitted);
- checkpoints where C3 shows a denied item holding a leak target that C4 does
  not show, and the reverse (the PR 3 verifier's N-1), with their ids for
  access-control checkpoints.

The lists come from core's own `retrieve` and `walkToAdmitted` and the plane's
`evaluateRead`, reached through packages/runner/scripts/c4-evidence.ts, never
reimplemented here; this script checks the data against the pinned hashes
(fetching it into .engram/upstream when the config allows) and aggregates.
No model is called. A live model chooses its own query, so these are the
lists for the checkpoint's question, not for every read a session makes.
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.h1_c4_verdict_agreement import node_rows
from scripts.results_io import REPO, ensure_pinned_gatemem, load_config, write_result

LISTS = ("c3", "c4", "c4_allowed", "c4_denied", "c5")
ACCESS_CONTROL = "privacy"


def _bucket(n: int, limit: int) -> str:
    if n == 0:
        return "none"
    if n < limit:
        return f"1-{limit - 1}"
    if n == limit:
        return f"exactly {limit}"
    for low, high in (
        (limit + 1, 2 * limit),
        (2 * limit + 1, 4 * limit),
        (4 * limit + 1, 8 * limit),
    ):
        if n <= high:
            return f"{low}-{high}"
    return f"{8 * limit + 1}+"


def length_stats(lengths: Sequence[int], read_limit: int) -> dict[str, Any]:
    """C4's list lengths as c4-walk-lengths.ts reported them (quantiles by floor index)."""
    ordered = sorted(lengths)
    n = len(ordered)

    def quantile(q: float) -> int:
        return ordered[min(n - 1, int(q * (n - 1)))]

    names = [_bucket(x, read_limit) for x in (0, 1, read_limit)] + [
        _bucket(x, read_limit)
        for x in (read_limit + 1, 2 * read_limit + 1, 4 * read_limit + 1, 8 * read_limit + 1)
    ]
    histogram = dict.fromkeys(names, 0)
    for x in ordered:
        histogram[_bucket(x, read_limit)] += 1
    return {
        "min": ordered[0],
        "q1": quantile(0.25),
        "median": quantile(0.5),
        "q3": quantile(0.75),
        "max": ordered[-1],
        "mean": sum(ordered) / n,
        "over_limit": sum(1 for x in ordered if x > read_limit),
        "histogram": histogram,
    }


def group_stats(rows: Sequence[Mapping[str, Any]], read_limit: int) -> dict[str, Any]:
    n = len(rows)

    def leak_side(field: str) -> dict[str, int]:
        return {
            "checkpoints": sum(1 for r in rows if r[field] > 0),
            "items": sum(int(r[field]) for r in rows),
        }

    items = {name: sum(int(r[name]) for r in rows) for name in LISTS}
    return {
        "checkpoints": n,
        "items": items,
        "c4_over_c3": items["c4"] / items["c3"] if items["c3"] else 0.0,
        "c4_length": length_stats([int(r["c4"]) for r in rows], read_limit) if rows else None,
        "c4_allowed_equals_c5": sum(1 for r in rows if r["c4_allowed_equals_c5"]),
        "c4_fewer_than_c3": sum(1 for r in rows if r["c4"] < r["c3"]),
        "c4_equal_to_c3": sum(1 for r in rows if r["c4"] == r["c3"]),
        "c4_more_than_c3": sum(1 for r in rows if r["c4"] > r["c3"]),
        "c4_empty_with_candidates": sum(1 for r in rows if r["c4"] == 0 and r["candidates"] > 0),
        "no_candidates": sum(1 for r in rows if r["candidates"] == 0),
        "c3_denied_leak": leak_side("c3_denied_leak"),
        "c4_denied_leak": leak_side("c4_denied_leak"),
        "c3_only_denied_leak": leak_side("c3_only_denied_leak"),
        "c4_only_denied_leak": leak_side("c4_only_denied_leak"),
    }


def _grouped(rows: Iterable[Mapping[str, Any]], key: str) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r[key]), []).append(r)
    return dict(sorted(out.items()))


def summarise(rows: Sequence[Mapping[str, Any]], read_limit: int) -> dict[str, Any]:
    """Overall and per kind, and the ids of the checkpoints where C3 and C4 part."""
    access = [r for r in rows if r["kind"] == ACCESS_CONTROL]

    def ids(group: Iterable[Mapping[str, Any]], keep: Any) -> list[str]:
        return sorted(str(r["checkpoint_id"]) for r in group if keep(r))

    return {
        "all": group_stats(rows, read_limit),
        "kinds": {k: group_stats(g, read_limit) for k, g in _grouped(rows, "kind").items()},
        "ids": {
            "c4_empty_with_candidates": ids(rows, lambda r: r["c4"] == 0 and r["candidates"] > 0),
            "access_control_c3_only_denied_leak": ids(
                access, lambda r: r["c3_only_denied_leak"] > 0
            ),
            "access_control_c4_only_denied_leak": ids(
                access, lambda r: r["c4_only_denied_leak"] > 0
            ),
        },
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = REPO / str(config["data"])
    commit = ensure_pinned_gatemem(
        data, REPO / str(config["manifest"]), fetch=bool(config["fetch"])
    )
    presets = sorted(str(p) for p in config["presets"])
    read_limit = int(config["read_limit"])
    rows = node_rows(data, presets, "walk", ["--read-limit", str(read_limit)])
    return {
        "name": config["name"],
        "benchmark": "gatemem",
        "commit": commit,
        "query": "each checkpoint's own question",
        "read_limit": read_limit,
        "verdict": "engram (the plane's read decision under the preset, core evaluateRead)",
        "mapping": "ADR 0030 (packages/bench/src/gatemem/plane.ts)",
        "presets": presets,
        "primary_preset": str(config["primary_preset"]),
        "by_preset": {p: summarise(rows[p], read_limit) for p in presets},
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
