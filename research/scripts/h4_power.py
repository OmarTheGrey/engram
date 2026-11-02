"""H4 evidence: the items per model and per store that reach 80 percent power, by simulation.

Usage:
    uv run python research/scripts/h4_power.py \\
        --config research/configs/h4-power.json \\
        --out research/results/h4-power.json

Plan decision 2 of docs/tasks/prereg-v1-plan.md: H4's pilot is replaced by a
power calculation. For each cell of the config's grid (true violation rate,
equivalence margin, discordance kappa, seed model; research/analysis/power.py
states the generative model), simulated H4 studies run the analysis code's own
TOST on every pair of arms, and the ladder of sample sizes is walked from the
normal approximation's estimate to the smallest size whose simulated power
reaches the target. Two sizes are reported: as the test is written, and with a
study in which some pair showed no discordant item counted as a failure.
Every simulation's seed is drawn from the config's seed (AGENTS.md rule 6).
"""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from itertools import product
from pathlib import Path
from typing import Any, cast

from analysis.power import (
    Cell,
    PowerPoint,
    SeedModel,
    ladder,
    normal_approx_items,
    power_at,
    smallest_passing,
    start_rung,
)
from scripts.results_io import load_config, write_result


def cell_result(cell: Cell, config: Mapping[str, Any], index: int) -> dict[str, Any]:
    rungs = ladder(
        int(config["ladder_start"]), int(config["ladder_stop"]), int(config["steps_per_doubling"])
    )
    target = float(config["target_power"])
    seed = int(config["seed"]) * 1_000 + index
    cache: dict[int, PowerPoint] = {}

    def point(items: int) -> PowerPoint:
        if items not in cache:
            cache[items] = power_at(
                cell,
                items,
                simulations=int(config["simulations"]),
                seed=seed,
                resamples=int(config["resamples"]),
                alpha=float(config["alpha"]),
            )
        return cache[items]

    approx = normal_approx_items(cell, alpha=float(config["alpha"]), power=target)
    start = start_rung(rungs, approx)
    as_written = smallest_passing(rungs, start, lambda n: point(n).power, target)
    nondegenerate = smallest_passing(
        rungs,
        as_written if as_written is not None else start,
        lambda n: point(n).power_nondegenerate,
        target,
    )

    def at(r: int | None) -> dict[str, Any] | None:
        if r is None:
            return None
        p = point(rungs[r])
        below = cache.get(rungs[r - 1]) if r > 0 else None
        return {
            "items": rungs[r],
            "power": p.power,
            "power_nondegenerate": p.power_nondegenerate,
            "pair_power": p.pair_power,
            "power_one_rung_below": None if below is None else below.power,
        }

    return {
        "rate": cell.rate,
        "margin": cell.margin,
        "kappa": cell.kappa,
        "seed_model": cell.seed_model,
        "normal_approx_items_one_pair": approx,
        "as_written": at(as_written),
        "nondegenerate": at(nondegenerate),
        "evaluated": [
            {
                "items": p.items,
                "power": p.power,
                "power_nondegenerate": p.power_nondegenerate,
                "pair_power": p.pair_power,
            }
            for p in sorted(cache.values(), key=lambda p: p.items)
        ],
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    cells = [
        Cell(
            rate=float(rate),
            margin=float(margin),
            kappa=float(kappa),
            seed_model=cast(SeedModel, model),
            arms=int(config["arms"]),
            seeds=int(config["seeds_per_item"]),
        )
        for margin, rate, kappa, model in product(
            config["margins"], config["rates"], config["kappas"], config["seed_models"]
        )
    ]
    grid = [cell_result(cell, config, i) for i, cell in enumerate(cells)]
    keys = (
        "arms",
        "seeds_per_item",
        "simulations",
        "resamples",
        "alpha",
        "target_power",
        "seed",
        "ladder_start",
        "ladder_stop",
        "steps_per_doubling",
    )
    return {"name": config["name"], **{k: config[k] for k in keys}, "cells": grid}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
