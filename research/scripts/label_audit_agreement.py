"""The label audit's agreement: two members' filled sheets as disagreement rates and Cohen's kappa.

Usage:
    uv run python research/scripts/label_audit_agreement.py \\
        --config research/configs/label-audit.json --dir .engram/audit \\
        --members <first>,<second> [--out .engram/audit/agreement.json]

The benchmark labels come from the pinned data through the sampler's own
seeded draw (research/scripts/label_audit_sample.py `draw`), never from a
sheet a member can edit (review of PR 4's part A, P4A-3). For each
benchmark of the draw, from the two members' blind phase-1 sheets
(`<benchmark>-<member>.csv`):

- `label`: each member's own label of the item, in the benchmark's own
  vocabulary (GateMem: the expected action; MEM-INV-Bench: attack or
  legit). Reported: the members' disagreements, their rate and Cohen's kappa
  (null when chance agreement is 1, that is when both members give one label
  throughout); each member's disagreements with the benchmark's label; and
  the items both members label otherwise than the benchmark (the candidate
  label errors), by reference.

and, once both members' phase-2 sheets exist (`<benchmark>-<member>-keys.csv`):

- `keys_ok`: yes or no, whether the benchmark's scoring keys are the right
  ones. Reported: disagreements, rate and kappa between the members, and
  each member's count of "no". Null before phase 2.

The pre-registration reports the members' disagreement rate (ADR 0015). The
output holds counts and references only, no benchmark text, and is written
byte-stable. A blank or unknown label, or a sheet whose items differ from
the draw, is refused with the items named.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.label_audit_sample import AuditItem, draw, phase_1_labels
from scripts.results_io import REPO, load_config, write_result

YES_NO = ("yes", "no")


def cohen_kappa(first: Sequence[str], second: Sequence[str]) -> float | None:
    """(observed - chance) / (1 - chance) agreement; None when chance agreement is 1."""
    n = len(first)
    observed = sum(1 for a, b in zip(first, second, strict=True) if a == b) / n
    ca, cb = Counter(first), Counter(second)
    chance = sum(ca[k] * cb[k] for k in ca.keys() | cb.keys()) / (n * n)
    if chance >= 1.0:
        return None
    return (observed - chance) / (1.0 - chance)


def _pair(a: Sequence[str], b: Sequence[str]) -> dict[str, Any]:
    disagreements = sum(1 for x, y in zip(a, b, strict=True) if x != y)
    return {
        "disagreements": disagreements,
        "rate": disagreements / len(a),
        "kappa": cohen_kappa(a, b),
    }


def _keys_ok(path: Path, refs: Sequence[str]) -> list[str]:
    with path.open(encoding="utf-8", newline="") as f:
        rows = {row["ref"]: row for row in csv.DictReader(f)}
    if sorted(rows) != sorted(refs):
        raise ValueError(f"{path.name}: the sheet must hold the same items as the draw")
    values = [rows[r]["member_keys_ok"].strip().lower() for r in refs]
    bad = [f"{r}: {v!r}" for r, v in zip(refs, values, strict=True) if v not in YES_NO]
    if bad:
        raise ValueError(f"{path.name}: member_keys_ok must be yes or no; not {bad}")
    return values


def compare(
    benchmark: str, items: Sequence[AuditItem], directory: Path, members: Sequence[str]
) -> dict[str, Any]:
    """One benchmark's agreement; the benchmark labels from the draw's items."""
    refs = [i.ref for i in items]
    truth = [i.label for i in items]
    labels = {
        m: [phase_1_labels(directory / f"{benchmark}-{m}.csv", benchmark, refs)[r] for r in refs]
        for m in members
    }

    def against(m: str) -> dict[str, Any]:
        d = sum(1 for x, y in zip(labels[m], truth, strict=True) if x != y)
        return {"disagreements": d, "rate": d / len(refs)}

    keys_paths = {m: directory / f"{benchmark}-{m}-keys.csv" for m in members}
    present = [p.exists() for p in keys_paths.values()]
    if any(present) and not all(present):
        raise ValueError(f"{benchmark}: only one member's key sheet exists")
    keys_ok = None
    if all(present):
        ok = {m: _keys_ok(p, refs) for m, p in keys_paths.items()}
        keys_ok = {
            "between_members": _pair(ok[members[0]], ok[members[1]]),
            "no": {m: ok[m].count("no") for m in members},
        }
    return {
        "items": len(refs),
        "members": list(members),
        "label": {
            "between_members": _pair(labels[members[0]], labels[members[1]]),
            "against_benchmark": {m: against(m) for m in members},
            "both_against_benchmark": [
                r for k, r in enumerate(refs) if all(labels[m][k] != truth[k] for m in members)
            ],
        },
        "keys_ok": keys_ok,
    }


def compare_dir(
    directory: Path, members: Sequence[str], drawn: Mapping[str, Sequence[AuditItem]]
) -> dict[str, Any]:
    """Every benchmark of the draw, from the two members' sheets in `directory`."""
    if len(members) != 2 or len(set(members)) != 2:
        raise ValueError("the audit compares exactly two members")
    return {b: compare(b, items, directory, members) for b, items in sorted(drawn.items())}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dir", type=Path)
    parser.add_argument("--members", required=True, help="two member names, comma separated")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    directory = args.dir if args.dir is not None else REPO / str(config["out"])
    members = [m for m in str(args.members).split(",") if m]
    result = compare_dir(directory, members, draw(config))
    out = args.out if args.out is not None else directory / "agreement.json"
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
