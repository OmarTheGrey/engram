"""H4 evidence: the items per arm that reach 80 percent power at the test's level, by simulation.

Usage:
    uv run python research/scripts/h4_power.py \\
        --config research/configs/h4-power.json \\
        --out research/results/h4-power.json

Plan decision 2 of docs/tasks/prereg-v1-plan.md: H4's pilot is replaced by a
power calculation. For each cell of the config's grid (true violation rate,
equivalence margin, discordance kappa, seed model; research/analysis/power.py
states the generative model), simulated studies of three arms run the
analysis code's own TOST on every pair. H4 needs every pair to pass in every
family it names (stores and models, on GateMem and MemoryAgentBench), so each
cell reports the items per arm for a per-family power of 0.8 (one family),
0.8 ** (1/2) (two families jointly at 0.8) and 0.8 ** (1/4) (four), assuming
families pass or fail independently. Under the generative model a family of
stores and a family of models are the same three exchangeable arms, so one
table serves both; they differ only in the kappa a reader assumes for each.

For each target the ladder of sizes is walked from the normal
approximation's estimate with `simulations_walk` studies per size; the rung
it lands on and the rung below are then rerun with `simulations_confirm`
studies, and the smallest rung whose confirmed power reaches the target is
kept. A size is reported only if the TOST holds its level there: with one
pair's true difference on the margin, either way, equivalence is declared in
at most alpha plus two Monte Carlo standard errors of `simulations_size`
runs, under the cell's kappa and under kappa 0 (the sparsest disagreement);
otherwise the walk moves up a rung. Every seed comes from the config's seed
and the cell's index (AGENTS.md rule 6), so the result does not depend on
how the cells are spread over processes.
"""

from __future__ import annotations

import argparse
import math
import os
from collections.abc import Mapping, Sequence
from concurrent.futures import ProcessPoolExecutor
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
    size_at_margin,
    smallest_passing,
    start_rung,
)
from scripts.results_io import load_config, write_result


def size_tolerance(alpha: float, runs: int) -> float:
    """Alpha plus two Monte Carlo standard errors of a rate alpha over `runs` runs."""
    return alpha + 2 * math.sqrt(alpha * (1 - alpha) / runs)


def cell_result(cell: Cell, config: Mapping[str, Any], index: int) -> dict[str, Any]:
    rungs = ladder(
        int(config["ladder_start"]), int(config["ladder_stop"]), int(config["steps_per_doubling"])
    )
    alpha = float(config["alpha"])
    resamples = int(config["resamples"])
    seed = int(config["seed"]) * 1_000 + index
    walk: dict[int, PowerPoint] = {}
    confirm: dict[int, PowerPoint] = {}
    sizes: dict[int, tuple[float, float]] = {}
    tolerance = size_tolerance(alpha, int(config["simulations_size"]))

    def power(cache: dict[int, PowerPoint], runs: int) -> Any:
        def at(items: int) -> float:
            if items not in cache:
                cache[items] = power_at(
                    cell, items, simulations=runs, seed=seed, resamples=resamples, alpha=alpha
                )
            return cache[items].power

        return at

    walked = power(walk, int(config["simulations_walk"]))
    confirmed = power(confirm, int(config["simulations_confirm"]))

    def size(items: int) -> tuple[float, float]:
        if items not in sizes:
            runs = int(config["simulations_size"])
            sizes[items] = (
                size_at_margin(
                    cell, items, simulations=runs, seed=seed, resamples=resamples, alpha=alpha
                ),
                size_at_margin(
                    cell,
                    items,
                    simulations=runs,
                    seed=seed + 500,
                    kappa=0.0,
                    resamples=resamples,
                    alpha=alpha,
                ),
            )
        return sizes[items]

    targets: dict[str, Any] = {}
    for families in config["families"]:
        target = float(config["target_power"]) ** (1 / int(families))
        approx = normal_approx_items(cell, alpha=alpha, power=target, joint=True)
        r = smallest_passing(rungs, start_rung(rungs, approx), walked, target)
        while r is not None:
            if confirmed(rungs[r]) < target:
                r = r + 1 if r + 1 < len(rungs) else None
            elif r > 0 and confirmed(rungs[r - 1]) >= target:
                r -= 1
            elif max(size(rungs[r])) > tolerance:
                r = r + 1 if r + 1 < len(rungs) else None
            else:
                break
        targets[str(families)] = {
            "families": int(families),
            "target_power": target,
            "normal_approx_items_joint": approx,
            "items": None if r is None else rungs[r],
            "power": None if r is None else confirm[rungs[r]].power,
            "pair_power": None if r is None else confirm[rungs[r]].pair_power,
            "power_one_rung_below": (None if r is None or r == 0 else confirm[rungs[r - 1]].power),
            "size_at_margin": None if r is None else sizes[rungs[r]][0],
            "size_at_margin_kappa_0": None if r is None else sizes[rungs[r]][1],
        }

    return {
        "rate": cell.rate,
        "margin": cell.margin,
        "kappa": cell.kappa,
        "seed_model": cell.seed_model,
        "normal_approx_items_one_pair": normal_approx_items(
            cell, alpha=alpha, power=float(config["target_power"])
        ),
        "size_tolerance": tolerance,
        "targets": targets,
        "evaluated": [
            {
                "items": n,
                "power_walk": walk[n].power if n in walk else None,
                "power_confirm": confirm[n].power if n in confirm else None,
                "size_at_margin": sizes[n][0] if n in sizes else None,
                "size_at_margin_kappa_0": sizes[n][1] if n in sizes else None,
            }
            for n in sorted(set(walk) | set(confirm) | set(sizes))
        ],
    }


def _cell_job(job: tuple[Cell, dict[str, Any], int]) -> dict[str, Any]:
    return cell_result(*job)


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
    # Each cell draws its seeds from the config's seed and its own index, so
    # the result does not depend on how the cells are spread over processes.
    jobs = [(cell, dict(config), i) for i, cell in enumerate(cells)]
    with ProcessPoolExecutor(max_workers=max(1, min(len(jobs), os.cpu_count() or 1))) as pool:
        grid = list(pool.map(_cell_job, jobs))
    keys = (
        "arms",
        "seeds_per_item",
        "families",
        "simulations_walk",
        "simulations_confirm",
        "simulations_size",
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
