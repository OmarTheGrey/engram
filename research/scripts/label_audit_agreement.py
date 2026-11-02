"""The label audit's agreement: two members' filled sheets as disagreement rates and Cohen's kappa.

Usage:
    uv run python research/scripts/label_audit_agreement.py \\
        --dir .engram/audit --members <first>,<second> [--out .engram/audit/agreement.json]

For each benchmark whose two sheets (`<benchmark>-<member>.csv`, written by
research/scripts/label_audit_sample.py and filled by the members) are in
`--dir`:

- `label`: each member's own label of the item, in the benchmark's own
  vocabulary (GateMem: the expected action; MEM-INV-Bench: attack or
  legit). Reported: the members' disagreements, their rate and Cohen's kappa
  (null when chance agreement is 1, that is when both members give one label
  throughout); each member's disagreements with the benchmark's label; and
  the items both members label otherwise than the benchmark (the candidate
  label errors).
- `targets_ok`: yes or no, whether the benchmark's scoring keys (GateMem's
  leak targets; MEM-INV-Bench's poisoned and legitimate values) are the right
  ones. Reported: disagreements, rate and kappa between the members, and each
  member's count of "no".

The pre-registration reports the members' disagreement rate (ADR 0015). The
output holds counts and item ids only, no benchmark text; it is written
byte-stable. A blank or unknown label, or two sheets with different items,
is refused with the items named.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import write_result

VOCABULARY = {
    "gatemem": {"answer", "answer_redacted", "refuse", "no_memory"},
    "mem-inv-bench": {"attack", "legit"},
}
YES_NO = {"yes", "no"}


def cohen_kappa(first: Sequence[str], second: Sequence[str]) -> float | None:
    """(observed - chance) / (1 - chance) agreement; None when chance agreement is 1."""
    n = len(first)
    observed = sum(1 for a, b in zip(first, second, strict=True) if a == b) / n
    ca, cb = Counter(first), Counter(second)
    chance = sum(ca[k] * cb[k] for k in ca.keys() | cb.keys()) / (n * n)
    if chance >= 1.0:
        return None
    return (observed - chance) / (1.0 - chance)


def read_sheet(path: Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return {row["item"]: row for row in csv.DictReader(f)}


def _values(
    rows: Mapping[str, Mapping[str, str]], items: Sequence[str], column: str, allowed: set[str]
) -> list[str]:
    values = [rows[i][column].strip().lower() for i in items]
    bad = [f"{i}: {v!r}" for i, v in zip(items, values, strict=True) if v not in allowed]
    if bad:
        raise ValueError(f"{column} must be one of {sorted(allowed)}; not {', '.join(bad)}")
    return values


def _pair(a: Sequence[str], b: Sequence[str]) -> dict[str, Any]:
    disagreements = sum(1 for x, y in zip(a, b, strict=True) if x != y)
    return {
        "disagreements": disagreements,
        "rate": disagreements / len(a),
        "kappa": cohen_kappa(a, b),
    }


def compare(
    benchmark: str,
    sheets: Mapping[str, Mapping[str, Mapping[str, str]]],
) -> dict[str, Any]:
    """One benchmark's agreement from each member's sheet (rows by item)."""
    members = list(sheets)
    first, second = (sheets[m] for m in members)
    if set(first) != set(second):
        raise ValueError(f"{benchmark}: the two sheets must hold the same items")
    items = sorted(first)
    vocabulary = VOCABULARY[benchmark]
    labels = {m: _values(sheets[m], items, "member_label", vocabulary) for m in members}
    targets = {m: _values(sheets[m], items, "member_targets_ok", YES_NO) for m in members}
    benchmark_labels = [first[i]["benchmark_label"].strip().lower() for i in items]

    def against(m: str) -> dict[str, Any]:
        d = sum(1 for x, y in zip(labels[m], benchmark_labels, strict=True) if x != y)
        return {"disagreements": d, "rate": d / len(items)}

    both = [
        i for k, i in enumerate(items) if all(labels[m][k] != benchmark_labels[k] for m in members)
    ]
    return {
        "items": len(items),
        "members": members,
        "label": {
            "between_members": _pair(labels[members[0]], labels[members[1]]),
            "against_benchmark": {m: against(m) for m in members},
            "both_against_benchmark": both,
        },
        "targets_ok": {
            "between_members": _pair(targets[members[0]], targets[members[1]]),
            "no": {m: targets[m].count("no") for m in members},
        },
    }


def compare_dir(directory: Path, members: Sequence[str]) -> dict[str, Any]:
    """Every benchmark whose two members' sheets are in `directory`."""
    if len(members) != 2:
        raise ValueError("the audit compares exactly two members")
    out: dict[str, Any] = {}
    for benchmark in sorted(VOCABULARY):
        paths = {m: directory / f"{benchmark}-{m}.csv" for m in members}
        if not any(p.exists() for p in paths.values()):
            continue
        missing = [str(p) for p in paths.values() if not p.exists()]
        if missing:
            raise ValueError(f"{benchmark}: missing {missing}")
        out[benchmark] = compare(benchmark, {m: read_sheet(p) for m, p in paths.items()})
    if not out:
        raise ValueError(f"no filled sheets for {list(members)} in {directory}")
    return out


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", type=Path, required=True)
    parser.add_argument("--members", required=True, help="two member names, comma separated")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    members = [m for m in str(args.members).split(",") if m]
    result = compare_dir(args.dir, members)
    out = args.out if args.out is not None else args.dir / "agreement.json"
    write_result(out, result)
    for benchmark, r in result.items():
        b = r["label"]["between_members"]
        print(
            f"label-audit: {benchmark}: {r['items']} items, members disagree on "
            f"{b['disagreements']} ({b['rate']:.3f}), kappa {b['kappa']}"
        )
    print(f"label-audit: written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
