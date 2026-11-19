"""The label audit's agreement: two or three members' sheets as disagreement rates and kappas.

Usage:
    uv run python research/scripts/label_audit_agreement.py \\
        --config research/configs/label-audit.json --dir .engram/audit \\
        --members <first>,<second>[,<third>] [--out .engram/audit/agreement.json]

The lead named three members on 2026-11-19 (decision sheet item 16, changed:
`docs/log/2026-11-19-lead-decision-16-three-members.md`). With two members
the report is exactly what it was for two; what three change is said at the
end of this docstring.

The benchmark labels come from the pinned data through the sampler's own
seeded draw (research/scripts/label_audit_sample.py `draw`), never from a
sheet a member can edit (review of PR 4's part A, P4A-3). For each
benchmark of the draw, from the members' blind phase-1 sheets
(`<benchmark>-<member>.csv`):

- `label`: each member's own label of the item, in the benchmark's own
  vocabulary (GateMem: the expected action; MEM-INV-Bench: attack or
  legit). Reported: the members' disagreements, their rate and Cohen's kappa
  (null when chance agreement is 1, that is when both members give one label
  throughout); each member's disagreements with the benchmark's label; and
  the items both members label otherwise than the benchmark (the candidate
  label errors), by reference.

and, once every member's phase-2 sheets exist (`<benchmark>-<member>-keys.csv`):

- `keys_ok`: yes or no, whether the benchmark's scoring keys are the right
  ones. Reported: disagreements, rate and kappa between the members, and
  each member's count of "no". Null before phase 2.

The stopping rule (PR 4's final fix round, D4), on what decides a
violation:

- `rejected`: the items both members reject, by reference (`refs`), with
  their `count` and the `rule` applied. On GateMem an item is rejected when
  both answer no on its scoring keys, the leak targets that decide every
  violation; the expected-action label's agreement is reported above and
  stops nothing. On MEM-INV-Bench an item is rejected when both members'
  phase-1 label differs from the benchmark's family, or both answer no on
  its keys; an item rejected both ways counts once.
- `stop_share`: the threshold, from the config (`research/configs/label-audit.json`).
- `stop`: true when more than `stop_share` of the benchmark's items are
  rejected (a benchmark's runs then wait for an amendment); false when not,
  once both members' key sheets are in; null before that, unless the
  rejections counted so far already exceed the threshold.

With three members (the orchestrator's rule, for the lead to confirm:
`docs/log/2026-11-19-orch-decision-two-of-three.md`), "both" reads "at
least two of the three" throughout. An item is rejected when at least two
members answer no on its keys, or, on MEM-INV-Bench, when at least two label
it otherwise than the family; two of one kind are needed, so one member's
label and another's no reject nothing. The candidate label errors are
`two_or_more_against_benchmark`. Each `between_members` then gives the items
the three do not all label alike (`disagreements`, `rate`), Fleiss' kappa
over the three (`fleiss_kappa`) and each pair's disagreements, rate and
Cohen's kappa (`pairs`, keyed `<a>/<b>`). `stop_share` and its counts are
unchanged; `stop` stays null until every member's key sheets exist, unless
the rejections already pass the threshold, and some but not all members'
key sheets are refused.

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
from itertools import combinations
from pathlib import Path
from typing import Any

from scripts.label_audit_sample import AuditItem, draw, phase_1_labels
from scripts.results_io import REPO, load_config, write_result

YES_NO = ("yes", "no")
# An item is rejected when at least this many members reject it: both of two, two of three.
REJECT_QUORUM = 2


def cohen_kappa(first: Sequence[str], second: Sequence[str]) -> float | None:
    """(observed - chance) / (1 - chance) agreement; None when chance agreement is 1."""
    n = len(first)
    observed = sum(1 for a, b in zip(first, second, strict=True) if a == b) / n
    ca, cb = Counter(first), Counter(second)
    chance = sum(ca[k] * cb[k] for k in ca.keys() | cb.keys()) / (n * n)
    if chance >= 1.0:
        return None
    return (observed - chance) / (1.0 - chance)


def fleiss_kappa(columns: Sequence[Sequence[str]]) -> float | None:
    """Fleiss' kappa, one list of labels per rater; None when chance agreement is 1."""
    raters, n = len(columns), len(columns[0])
    per_item = [Counter(column[k] for column in columns) for k in range(n)]
    pairs = raters * (raters - 1)
    agreeing = [(sum(c * c for c in counts.values()) - raters) / pairs for counts in per_item]
    observed = sum(agreeing) / n
    totals: Counter[str] = Counter()
    for counts in per_item:
        totals.update(counts)
    chance = sum((c / (n * raters)) ** 2 for c in totals.values())
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


def _between(values: Mapping[str, Sequence[str]], members: Sequence[str]) -> dict[str, Any]:
    """Two members: their pair. Three: the items not labelled alike, Fleiss' kappa, every pair."""
    if len(members) == 2:
        return _pair(values[members[0]], values[members[1]])
    columns = [values[m] for m in members]
    n = len(columns[0])
    split = sum(1 for k in range(n) if len({column[k] for column in columns}) > 1)
    return {
        "disagreements": split,
        "rate": split / n,
        "fleiss_kappa": fleiss_kappa(columns),
        "pairs": {f"{a}/{b}": _pair(values[a], values[b]) for a, b in combinations(members, 2)},
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
    benchmark: str,
    items: Sequence[AuditItem],
    directory: Path,
    members: Sequence[str],
    *,
    stop_share: float,
) -> dict[str, Any]:
    """One benchmark's agreement and stopping rule; the benchmark labels from the draw's items."""
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
        if len(members) == 2:
            raise ValueError(f"{benchmark}: only one member's key sheet exists")
        have = ", ".join(m for m, p in keys_paths.items() if p.exists())
        missing = ", ".join(m for m, p in keys_paths.items() if not p.exists())
        raise ValueError(f"{benchmark}: key sheets exist for {have} but not for {missing}")
    keys_ok = None
    keys_no: set[str] = set()
    if all(present):
        ok = {m: _keys_ok(p, refs) for m, p in keys_paths.items()}
        keys_ok = {
            "between_members": _between(ok, members),
            "no": {m: ok[m].count("no") for m in members},
        }
        keys_no = {
            r for k, r in enumerate(refs) if sum(ok[m][k] == "no" for m in members) >= REJECT_QUORUM
        }
    against_truth = [
        r
        for k, r in enumerate(refs)
        if sum(labels[m][k] != truth[k] for m in members) >= REJECT_QUORUM
    ]
    if len(members) == 2:
        who, again, errors = "both members", "both", "both_against_benchmark"
    else:
        who, again = "at least two of the three members", "at least two"
        errors = "two_or_more_against_benchmark"
    if benchmark == "mem-inv-bench":
        rule = f"{who} label otherwise than the family, or {again} answer no on the keys"
        rejected_set = keys_no | set(against_truth)
    else:
        rule = f"{who} answer no on the keys"
        rejected_set = keys_no
    rejected = [r for r in refs if r in rejected_set]
    over = len(rejected) > stop_share * len(refs)
    stop: bool | None = over if all(present) else (True if over else None)
    return {
        "items": len(refs),
        "members": list(members),
        "label": {
            "between_members": _between(labels, members),
            "against_benchmark": {m: against(m) for m in members},
            errors: against_truth,
        },
        "keys_ok": keys_ok,
        "rejected": {"rule": rule, "refs": rejected, "count": len(rejected)},
        "stop_share": stop_share,
        "stop": stop,
    }


def compare_dir(
    directory: Path,
    members: Sequence[str],
    drawn: Mapping[str, Sequence[AuditItem]],
    *,
    stop_share: float,
) -> dict[str, Any]:
    """Every benchmark of the draw, from the two or three members' sheets in `directory`."""
    if len(members) not in (2, 3) or len(set(members)) != len(members):
        raise ValueError("the audit compares two or three distinct members")
    if not 0.0 < stop_share < 1.0:
        raise ValueError("stop_share must lie in (0, 1)")
    return {
        b: compare(b, items, directory, members, stop_share=stop_share)
        for b, items in sorted(drawn.items())
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dir", type=Path)
    parser.add_argument(
        "--members", required=True, help="two or three member names, comma separated"
    )
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    directory = args.dir if args.dir is not None else REPO / str(config["out"])
    members = [m for m in str(args.members).split(",") if m]
    result = compare_dir(directory, members, draw(config), stop_share=float(config["stop_share"]))
    out = args.out if args.out is not None else directory / "agreement.json"
    write_result(out, result)
    for benchmark, r in result.items():
        b = r["label"]["between_members"]
        if len(members) == 2:
            agree, reject = f"kappa {b['kappa']}", "both reject"
        else:
            agree, reject = f"Fleiss' kappa {b['fleiss_kappa']}", "two or more reject"
        print(
            f"label-audit: {benchmark}: {r['items']} items, members disagree on "
            f"{b['disagreements']} ({b['rate']:.3f}), {agree}; {reject} "
            f"{r['rejected']['count']}, stop {r['stop']}"
        )
    print(f"label-audit: written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
