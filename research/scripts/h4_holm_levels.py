"""H4 evidence: the committed alpha-0.01 sizes at every threshold Holm may test H4 at.

Usage:
    uv run python research/scripts/h4_holm_levels.py \\
        --config research/configs/h4-holm-levels.json \\
        --out research/results/h4-holm-levels.json

H4's one p-value, the intersection-union p of research/analysis/equivalence.py,
enters Holm over the five hypotheses' primary p-values at family-wise alpha
0.05, so it is compared with 0.05 / k for some k from 1 to 5 (0.05, 0.025,
0.0167, 0.0125, 0.01), depending on its rank. research/results/h4-power.json
admits a size at alpha 0.01 only where the TOST holds its level at 0.01 and
records the check at 0.05 and 0.01 only (PR 2 of the plan; the final
verification's P2v4-1). This script takes every distinct (items, margin)
that result commits at alpha 0.01 and runs the same search at each of the
five thresholds: `composite_sup` (research/analysis/power.py), the largest
level a search over the composite null's boundary (|mean| = margin) found,
every level exact, under the iid-items model. A size holds when the level
found is at most the threshold at every k; `all_hold` says whether every
size does. The search is the power script's own; nothing is reimplemented.
research/tests/test_h4_holm_levels.py checks this record covers exactly the
committed table (by its sha256) and that every level holds.
"""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

from analysis.power import composite_sup
from scripts.results_io import REPO, load_config, sha256_file, workers, write_result


def thresholds(alpha: float, hypotheses: int) -> list[float]:
    """Holm's thresholds for one hypothesis among `hypotheses`: alpha / k, k = 1 to hypotheses."""
    return [alpha / k for k in range(1, hypotheses + 1)]


def committed_sizes(power: Mapping[str, Any], alpha: str) -> list[tuple[int, float]]:
    """Every distinct (items, margin) the power table commits at `alpha`, sorted."""
    sizes = {
        (int(t["items"]), float(cell["margin"]))
        for cell in power["cells"]
        for t in cell["alphas"][alpha]["targets"].values()
        if t["items"] is not None
    }
    return sorted(sizes, key=lambda s: (s[1], s[0]))


def _sup(job: tuple[int, float, float]) -> dict[str, Any]:
    items, margin, threshold = job
    return composite_sup(items, margin, threshold)


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    power_path = REPO / str(config["power_result"])
    power = load_config(power_path)
    alpha = str(config["committed_alpha"])
    sizes = committed_sizes(power, alpha)
    levels = thresholds(float(config["family_alpha"]), int(config["hypotheses"]))
    jobs = [(n, m, t) for n, m in sizes for t in levels]
    with ProcessPoolExecutor(workers(len(jobs))) as pool:
        sups = list(pool.map(_sup, jobs))
    found = iter(sups)
    rows = []
    for items, margin in sizes:
        checks = {}
        for k, t in enumerate(levels, start=1):
            sup = next(found)
            checks[str(k)] = {
                "threshold": t,
                "composite_sup": sup["level"],
                "found": sup["found"],
                "holds": sup["level"] <= t,
            }
        tightest = min(checks, key=lambda k: checks[k]["threshold"] - checks[k]["composite_sup"])
        rows.append(
            {
                "items": items,
                "margin": margin,
                "levels": checks,
                "tightest_k": int(tightest),
                "slack": checks[tightest]["threshold"] - checks[tightest]["composite_sup"],
            }
        )
    tight = min(rows, key=lambda r: r["slack"])
    return {
        "name": config["name"],
        "hypothesis": "H4",
        "power_result": {"file": config["power_result"], "sha256": sha256_file(power_path)},
        "committed_alpha": alpha,
        "family_alpha": float(config["family_alpha"]),
        "hypotheses": int(config["hypotheses"]),
        "thresholds": levels,
        "sizes": rows,
        "all_hold": all(c["holds"] for r in rows for c in r["levels"].values()),
        "tightest": {k: tight[k] for k in ("items", "margin", "tightest_k", "slack")},
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
