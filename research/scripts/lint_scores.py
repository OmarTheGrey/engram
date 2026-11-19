"""Lint precision and recall on card L2's seeded-fault set (card L4): the shared scoring.

The lints run in TypeScript (packages/runner/src/lint-fault-set.ts); this
module only joins what they found with the set's labels, which never reached
the plane. A tier flags a label when one of its findings lands on the label's
`finding_on` (the labelled item, or for a pair the contradiction lint judges,
the later item of the pair, card L2's decision `finding_on`), whatever lint of
the tier found it. On the labelled items:

- recall is the share of faults flagged, precision the share of flagged
  labelled items that are faults (a flagged near-miss is a false positive),
  each with its 95 percent Wilson interval (research/analysis/wilson.py);
- per class, keyed and unkeyed apart and pooled, per subtype and per variant.

An item a tier flags that is no label's `finding_on` is unverified: one of
LongMemEval's own items (base), or an item the generator wrote that no label
is about (a source, a counterpart). It is counted, never scored; with it, the
labelled precision becomes a bound: at least TP / (TP + FP + U), if every
unverified finding is false, and at most (TP + U) / (TP + FP + U).

Per lint, only the labels about that lint count: faults it is expected to
find and near-misses of it; its findings elsewhere (on other labelled items,
on unlabelled injected items, on base items) are counted apart.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.wilson import wilson

CLASSES = ("stale", "contradictory", "misplaced", "unsupported")
TIERS = ("deterministic", "model")
KEYS = ("keyed", "unkeyed", "all")

Label = Mapping[str, Any]
# tier -> lint -> flagged item ids, for one state (and one seed).
Flags = dict[str, dict[str, set[str]]]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    """A JSON Lines file split on the newline byte only (LongMemEval's text holds U+2028)."""
    import json

    text = path.read_bytes().decode("utf-8")
    return [json.loads(line) for line in text.split("\n") if line.strip()]


def by_question(labels: Iterable[Label]) -> dict[str, list[Label]]:
    out: dict[str, list[Label]] = {}
    for la in labels:
        out.setdefault(str(la["question_id"]), []).append(la)
    return out


def label_unit(label: Label, lint: str) -> str:
    """The unit card L3's lint judges for a label: its pair, sorted, or its claim."""
    if lint == "contradiction":
        return "contradiction:" + "+".join(sorted([str(label["item_id"]), *label["related"]]))
    return f"{lint}:{label['item_id']}"


def flags_of(findings: Iterable[Mapping[str, Any]]) -> tuple[Flags, set[str]]:
    """A state's findings as flagged items per tier and lint, and the base items among them."""
    flags: Flags = {t: {} for t in TIERS}
    base: set[str] = set()
    for f in findings:
        tier = flags.setdefault(str(f["tier"]), {})
        tier.setdefault(str(f["lint_id"]), set()).add(str(f["item_id"]))
        if f["base"]:
            base.add(str(f["item_id"]))
    return flags, base


def flagged_by(flags: Flags, tiers: Sequence[str], lint: str | None = None) -> set[str]:
    """Items any lint of `tiers` (or the one `lint`) flagged."""
    out: set[str] = set()
    for t in tiers:
        for name, items in flags.get(t, {}).items():
            if lint is None or name == lint:
                out |= items
    return out


def rate(successes: float, n: float) -> dict[str, Any]:
    """A share with its Wilson interval; null when there is nothing to share.

    The interval needs a whole n (the items); a share whose denominator is a
    seed average has none.
    """
    if n <= 0:
        return {"value": None, "ci": None}
    ci = list(wilson(successes, int(n))) if float(n).is_integer() else None
    return {"value": successes / n, "ci": ci}


def cell(faults: float, tp: float, near_misses: float, fp: float) -> dict[str, Any]:
    """Recall and labelled precision of one group; counts may be seed averages."""
    return {
        "faults": faults,
        "near_misses": near_misses,
        "tp": tp,
        "fp": fp,
        "recall": rate(tp, faults),
        "precision": rate(tp, tp + fp),
    }


def _key(la: Label) -> str:
    return "keyed" if la["keyed"] else "unkeyed"


def hits(
    labels: Mapping[str, Sequence[Label]],
    flags: Mapping[str, Flags],
    tiers: Sequence[str],
) -> list[tuple[Label, bool]]:
    """Every label, and whether `tiers` flagged its finding_on, in question then label order."""
    out: list[tuple[Label, bool]] = []
    for q in sorted(labels):
        found = flagged_by(flags.get(q, {t: {} for t in TIERS}), tiers)
        out.extend((la, str(la["finding_on"]) in found) for la in labels[q])
    return out


def groups(scored: Sequence[tuple[Label, float]]) -> dict[str, Any]:
    """Cells per class (keyed, unkeyed, all), per subtype (and variant), and overall.

    `scored` pairs each label with the share of runs that flagged it (1 or 0
    for one run; a seed average otherwise).
    """

    def make(rows: Sequence[tuple[Label, float]]) -> dict[str, Any]:
        faults = [h for la, h in rows if la["kind"] == "fault"]
        nms = [h for la, h in rows if la["kind"] == "near-miss"]
        return cell(len(faults), sum(faults), len(nms), sum(nms))

    def keyed(rows: Sequence[tuple[Label, float]]) -> dict[str, Any]:
        return {
            "keyed": make([r for r in rows if _key(r[0]) == "keyed"]),
            "unkeyed": make([r for r in rows if _key(r[0]) == "unkeyed"]),
            "all": make(rows),
        }

    by_class = {c: keyed([r for r in scored if r[0]["class"] == c]) for c in CLASSES}
    by_subtype: dict[str, Any] = {}
    for st in sorted({str(la["subtype"]) for la, _ in scored}):
        mine = [r for r in scored if r[0]["subtype"] == st]
        first = mine[0][0]
        entry = {"class": first["class"], "keyed": bool(first["keyed"]), **make(mine)}
        variants = sorted({str(la["variant"]) for la, _ in mine if la["variant"] is not None})
        if variants:
            entry["variants"] = {
                v: make([r for r in mine if r[0]["variant"] == v]) for v in variants
            }
        by_subtype[st] = entry
    return {"by_class": by_class, "by_subtype": by_subtype, "overall": keyed(scored)}


def unverified(
    labels: Mapping[str, Sequence[Label]],
    flags: Mapping[str, Flags],
    base: Mapping[str, set[str]],
    tiers: Sequence[str],
    lint: str | None = None,
) -> dict[str, int]:
    """Flagged items that are no label's finding_on: base items or injected ones."""
    out = {"base": 0, "injected": 0}
    for q in sorted(set(labels) | set(flags)):
        found = flagged_by(flags.get(q, {t: {} for t in TIERS}), tiers, lint)
        aimed = {str(la["finding_on"]) for la in labels.get(q, [])}
        for item in found - aimed:
            out["base" if item in base.get(q, set()) else "injected"] += 1
    return out


def bound(tp: float, fp: float, unverified_count: float) -> dict[str, Any]:
    """Labelled precision with the unverified findings counted: the count and both ends."""
    n = tp + fp + unverified_count
    return {
        "unverified": unverified_count,
        "lower": tp / n if n else None,
        "upper": (tp + unverified_count) / n if n else None,
    }


def tier_scores(
    labels: Mapping[str, Sequence[Label]],
    flags: Mapping[str, Flags],
    base: Mapping[str, set[str]],
    tiers: Sequence[str],
) -> dict[str, Any]:
    """Every group's cells for `tiers` on one run, and the overall precision bound."""
    scored: list[tuple[Label, float]] = [
        (la, 1 if h else 0) for la, h in hits(labels, flags, tiers)
    ]
    out = groups(scored)
    u = unverified(labels, flags, base, tiers)
    overall = out["overall"]["all"]
    out["unverified"] = u
    out["precision_with_unverified"] = bound(
        overall["tp"], overall["fp"], u["base"] + u["injected"]
    )
    return out


def lint_scores(
    labels: Mapping[str, Sequence[Label]],
    flags: Mapping[str, Flags],
    base: Mapping[str, set[str]],
    tier: str,
    lints: Sequence[str],
) -> dict[str, Any]:
    """Per lint of `tier`: its own labels' cells, and where else it flagged."""
    out: dict[str, Any] = {}
    for lint in lints:
        faults = nms = tp = fp = 0
        elsewhere = {"other_labels": 0, "unlabelled_injected": 0, "base": 0}
        for q in sorted(set(labels) | set(flags)):
            found = flagged_by(flags.get(q, {t: {} for t in TIERS}), [tier], lint)
            mine = labels.get(q, [])
            own: set[str] = set()
            for la in mine:
                target = str(la["finding_on"])
                if lint in la["expected"][tier]:
                    faults += 1
                    tp += target in found
                    own.add(target)
                elif lint in la["near_miss_of"][tier]:
                    nms += 1
                    fp += target in found
                    own.add(target)
            targets = {str(la["finding_on"]) for la in mine}
            for item in found - own:
                if item in targets:
                    elsewhere["other_labels"] += 1
                elif item in base.get(q, set()):
                    elsewhere["base"] += 1
                else:
                    elsewhere["unlabelled_injected"] += 1
        out[lint] = {
            **cell(faults, tp, nms, fp),
            "elsewhere": elsewhere,
            "precision_with_unverified": bound(tp, fp, sum(elsewhere.values())),
        }
    return out


def lints_of(labels: Iterable[Label], flags: Iterable[Flags], tier: str) -> list[str]:
    """Every lint of `tier` a label is about or a finding names, sorted."""
    names = {str(x) for la in labels for f in ("expected", "near_miss_of") for x in la[f][tier]}
    for fl in flags:
        names |= set(fl.get(tier, {}))
    return sorted(names)
