"""Card L5: the near-duplicate tier on the fault catalogue, checked against datasketch.

Usage:
    uv run python research/scripts/near_duplicate.py \\
        --config research/configs/near-duplicate.json \\
        --out research/results/h3-near-duplicate.json

packages/core/scripts/near-duplicate-pairs.ts runs Plane.lint with the
near-duplicate tier alone over every fixture of the fault catalogue
(fixtures/faults/*.json) at the config's threshold, and writes every pair of
one scope's active items of one class with distinct strict hashes, with its
shingles, its exact Jaccard similarity and the tier's MinHash estimate. This
script hashes the same shingles with datasketch's MinHash (the oracle,
research code only) and reports:

- agreement (card R2's measure (a) of the proposed arm P4): at each threshold
  of the registered presets, the share of pairs the tier's estimate and the
  oracle's put on the same side, with a Wilson interval, beside each one's
  agreement with the exact Jaccard similarity and the mean absolute
  differences. A check of the implementation: both estimate one similarity.
- precision and recall on the tier's own fixtures (near-duplicate-tier.flag
  and .near-miss), item by item, with Wilson intervals.
- the tier's findings on the other lints' fixtures, unlabelled.

Exploratory: not part of H3's registered analysis until its arm (P4) is
registered by amendment. No model is called.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from datasketch import MinHash  # type: ignore[import-untyped]

from analysis.wilson import wilson
from scripts.results_io import REPO, load_config, run_node, write_result

ENTRY = "packages/core/scripts/near-duplicate-pairs.ts"
# The agreement is also reported on the pairs whose estimate or exact similarity is at least this.
NEAR = 0.7


def rate(hits: int, n: int, confidence: float) -> dict[str, Any]:
    """A proportion with its Wilson interval; null for an empty set."""
    if n == 0:
        return {"n": 0, "count": 0, "rate": None, "wilson": None}
    lo, hi = wilson(hits, n, confidence)
    return {"n": n, "count": hits, "rate": hits / n, "wilson": [lo, hi]}


def oracle_estimate(a: Sequence[str], b: Sequence[str], num_perm: int, seed: int) -> float:
    """datasketch's MinHash estimate of the Jaccard similarity of two shingle sets."""
    ma = MinHash(num_perm=num_perm, seed=seed)
    mb = MinHash(num_perm=num_perm, seed=seed)
    for s in a:
        ma.update(s.encode("utf-8"))
    for s in b:
        mb.update(s.encode("utf-8"))
    return float(ma.jaccard(mb))


def agreement(
    pairs: Sequence[Mapping[str, Any]], thresholds: Sequence[float], confidence: float
) -> dict[str, Any]:
    """Same-side agreement at each threshold, and the mean absolute differences."""
    n = len(pairs)
    out: dict[str, Any] = {"pairs": n, "by_threshold": {}}
    for t in thresholds:

        def same(key_a: str, key_b: str, t: float = t) -> int:
            return sum((p[key_a] >= t) == (p[key_b] >= t) for p in pairs)

        out["by_threshold"][f"{t:.2f}"] = {
            "tier_vs_oracle": rate(same("estimate", "oracle"), n, confidence),
            "tier_vs_exact": rate(same("estimate", "jaccard"), n, confidence),
            "oracle_vs_exact": rate(same("oracle", "jaccard"), n, confidence),
            "exact_at_or_above": sum(p["jaccard"] >= t for p in pairs),
        }

    def mae(key_a: str, key_b: str) -> float | None:
        return sum(abs(p[key_a] - p[key_b]) for p in pairs) / n if n else None

    out["mean_absolute_difference"] = {
        "tier_vs_oracle": mae("estimate", "oracle"),
        "tier_vs_exact": mae("estimate", "jaccard"),
        "oracle_vs_exact": mae("oracle", "jaccard"),
    }
    # Review finding L5-8: most catalogue pairs are far from every threshold,
    # where any two estimators agree; the pairs near it are the test.
    near = [p for p in pairs if p["estimate"] >= NEAR or p["jaccard"] >= NEAR]
    out["near_pairs"] = {
        "at_or_above": NEAR,
        "pairs": len(near),
        "by_threshold": {
            f"{t:.2f}": rate(
                sum((p["estimate"] >= t) == (p["oracle"] >= t) for p in near),
                len(near),
                confidence,
            )
            for t in thresholds
        },
    }
    out["max_absolute_difference_tier_vs_oracle"] = (
        max(abs(p["estimate"] - p["oracle"]) for p in pairs) if n else None
    )
    return out


def labelled(rows: Sequence[Mapping[str, Any]], confidence: float) -> dict[str, Any]:
    """Item-level precision and recall on the tier's own fixtures."""
    tp = fp = fn = 0
    for r in rows:
        if r["labelled_flags"] is None:
            continue
        want = set(r["labelled_flags"])
        got = {f["item"] for f in r["flagged"]}
        tp += len(got & want)
        fp += len(got - want)
        fn += len(want - got)
    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": rate(tp, tp + fp, confidence),
        "recall": rate(tp, tp + fn, confidence),
    }


def summarise(rows: Sequence[Mapping[str, Any]], config: Mapping[str, Any]) -> dict[str, Any]:
    oracle = config["oracle"]
    confidence = float(config["confidence"])
    pairs: list[dict[str, Any]] = []
    for r in rows:
        for p in r["pairs"]:
            a, b = p["shingles"]
            pairs.append(
                {
                    "fixture": r["fixture"],
                    "earlier": p["earlier"],
                    "later": p["later"],
                    "kind": p["kind"],
                    "jaccard": p["jaccard"],
                    "estimate": p["estimate"],
                    "oracle": oracle_estimate(a, b, int(oracle["num_perm"]), int(oracle["seed"])),
                }
            )
    unlabelled = {
        r["fixture"]: len(r["flagged"])
        for r in rows
        if r["labelled_flags"] is None and r["flagged"]
    }
    return {
        "name": config["name"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "threshold": float(config["threshold"]),
        "oracle": dict(oracle),
        "fixtures": len(rows),
        "agreement": agreement(
            pairs, [float(t) for t in config["agreement_thresholds"]], confidence
        ),
        "labelled": labelled(rows, confidence),
        "unlabelled_findings": {
            "fixtures": len(unlabelled),
            "findings": sum(unlabelled.values()),
            "by_fixture": unlabelled,
        },
        "pairs": pairs,
        "limits": list(config["limits"]),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if config["oracle"]["package"] != "datasketch":
        raise SystemExit("near_duplicate: the oracle is datasketch")
    installed = importlib.metadata.version("datasketch")
    if installed != config["oracle"]["version"]:
        raise SystemExit(
            f"near_duplicate: datasketch {installed} is installed; the config pins "
            f"{config['oracle']['version']}"
        )
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "pairs.json"
        run_node(
            [
                ENTRY,
                "--faults",
                str(REPO / str(config["faults"])),
                "--threshold",
                str(config["threshold"]),
                "--out",
                str(out),
            ]
        )
        rows = json.loads(out.read_text(encoding="utf-8"))
    write_result(args.out, summarise(rows, config))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
