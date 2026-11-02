"""H4 evidence: the items per arm that reach 80 percent power where the TOST holds its level.

Usage:
    uv run python research/scripts/h4_power.py \\
        --config research/configs/h4-power.json \\
        --out research/results/h4-power.json

Plan decision 2 of docs/tasks/prereg-v1-plan.md: H4's pilot is replaced by a
power calculation. For each cell of the config's grid (true violation rate,
equivalence margin, discordance kappa, seed model; research/analysis/power.py
states the generative model), simulated studies of three arms run the
analysis code's own TOST (research/analysis/equivalence.py) on every pair.
H4 needs every pair to pass in every family it names (stores and models, on
GateMem and MemoryAgentBench), so each cell reports the items per arm for a
per-family power of 0.8 (one family), 0.8 ** (1/2) (two families jointly at
0.8) and 0.8 ** (1/4) (four), assuming families pass or fail independently.
Under the generative model a family of stores and a family of models are the
same three exchangeable arms, so one table serves both; they differ only in
the kappa a reader assumes for each. Each size is given at every alpha of the
config: Holm over five hypotheses may test H4 at as little as 0.01.

For each target the ladder of sizes is walked from the joint normal
approximation's estimate with `simulations_walk` studies per size; the rung
it lands on and the rung below are then rerun with `simulations_confirm`
studies, and the smallest rung whose confirmed power reaches the target is
kept, provided the TOST holds its level there; otherwise the choice moves up
a rung. The level is held when, with one pair's true difference on the
margin, the exact level at kappa 0 is at most alpha under both seed models,
and the level measured over `simulations_level` runs either way round, at
every kappa of `level_kappas` and the cell's own under both seed models, is
at most alpha by two Monte Carlo standard errors. Every seed comes from the
config's seed and the cell's index (AGENTS.md rule 6), so the result does not
depend on how the cells are spread over processes.
"""

from __future__ import annotations

import argparse
import os
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ProcessPoolExecutor
from itertools import product
from pathlib import Path
from typing import Any, cast

from analysis.power import (
    SEED_MODELS,
    Cell,
    PowerPoint,
    SeedModel,
    choose_rung,
    exact_level,
    ladder,
    level_gate,
    normal_approx_items,
    power_at,
    simulated_level,
    smallest_passing,
    start_rung,
)
from scripts.results_io import load_config, write_result


def alpha_result(
    cell: Cell,
    config: Mapping[str, Any],
    seed: int,
    alpha: float,
    kappas: list[float],
) -> dict[str, Any]:
    """One cell at one alpha: a size per family target, with its power and its level."""
    rungs = ladder(
        int(config["ladder_start"]), int(config["ladder_stop"]), int(config["steps_per_doubling"])
    )
    level_runs = int(config["simulations_level"])
    walk: dict[int, PowerPoint] = {}
    confirm: dict[int, PowerPoint] = {}
    levels: dict[int, dict[str, Any]] = {}

    def power(cache: dict[int, PowerPoint], runs: int) -> Callable[[int], float]:
        def at(items: int) -> float:
            if items not in cache:
                cache[items] = power_at(cell, items, simulations=runs, seed=seed, alpha=alpha)
            return cache[items].power

        return at

    walked = power(walk, int(config["simulations_walk"]))
    confirmed = power(confirm, int(config["simulations_confirm"]))

    def level(items: int) -> dict[str, Any]:
        if items not in levels:
            exact = {
                m: exact_level(cell.margin, items, m, alpha=alpha, seeds=cell.seeds)
                for m in SEED_MODELS
            }
            measured = {
                f"{m} kappa {k:g}": simulated_level(
                    cell.rate,
                    cell.margin,
                    items,
                    k,
                    m,
                    runs=level_runs,
                    seed=seed,
                    alpha=alpha,
                    seeds=cell.seeds,
                )
                for k in kappas
                for m in SEED_MODELS
            }
            worst = max(measured, key=lambda key: measured[key])
            levels[items] = {
                "exact_kappa_0": exact,
                "simulated_max": measured[worst],
                "simulated_max_at": worst,
                "holds": level_gate(
                    list(exact.values()), list(measured.values()), alpha=alpha, runs=level_runs
                ),
            }
        return levels[items]

    def level_holds(i: int) -> bool:
        return bool(level(rungs[i])["holds"])

    def power_reaches(goal: float) -> Callable[[int], bool]:
        return lambda i: confirmed(rungs[i]) >= goal

    targets: dict[str, Any] = {}
    for families in config["families"]:
        target = float(config["target_power"]) ** (1 / int(families))
        approx = normal_approx_items(cell, alpha=alpha, power=target, joint=True)
        walked_to = smallest_passing(rungs, start_rung(rungs, approx), walked, target)
        r = (
            None
            if walked_to is None
            else choose_rung(len(rungs), walked_to, power_reaches(target), level_holds)
        )
        chosen = None if r is None else rungs[r]
        below = None if r is None or r == 0 else confirm.get(rungs[r - 1])
        targets[str(families)] = {
            "families": int(families),
            "target_power": target,
            "normal_approx_items_joint": approx,
            "items": chosen,
            "power": None if chosen is None else confirm[chosen].power,
            "pair_power": None if chosen is None else confirm[chosen].pair_power,
            "power_one_rung_below": None if below is None else below.power,
            "level_one_rung_below": (None if r is None or r == 0 else levels.get(rungs[r - 1])),
            "level": None if chosen is None else levels[chosen],
        }
    return {
        "alpha": alpha,
        "normal_approx_items_one_pair": normal_approx_items(
            cell, alpha=alpha, power=float(config["target_power"])
        ),
        "targets": targets,
        "evaluated": [
            {
                "items": n,
                "power_walk": walk[n].power if n in walk else None,
                "power_confirm": confirm[n].power if n in confirm else None,
                "level": levels.get(n),
            }
            for n in sorted(set(walk) | set(confirm) | set(levels))
        ],
    }


def cell_result(cell: Cell, config: Mapping[str, Any], index: int) -> dict[str, Any]:
    seed = int(config["seed"]) * 1_000 + index
    kappas = sorted({*(float(k) for k in config["level_kappas"]), cell.kappa})
    return {
        "rate": cell.rate,
        "margin": cell.margin,
        "kappa": cell.kappa,
        "seed_model": cell.seed_model,
        "level_kappas": kappas,
        "alphas": {
            f"{float(a):g}": alpha_result(cell, config, seed, float(a), kappas)
            for a in config["alphas"]
        },
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
        "alphas",
        "level_kappas",
        "simulations_walk",
        "simulations_confirm",
        "simulations_level",
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
