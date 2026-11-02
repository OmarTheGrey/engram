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
a rung. The level is held when, with the true difference on the margin, the
largest level found over the composite null (`composite_sup`: every
distribution of an item's difference on the three-seed lattice with its mean
on the margin, identical and independent seeds, any rates and kappas) is at
most alpha, and so are the exact levels of the cell's own pair on the
margin, rates (rate, rate + margin), under both seed models at every kappa
of `level_kappas` and the cell's own. Every level is exact
(`lattice_level`); none is simulated. Each size records which check set it:
power, the composite null, or the cell's own distributions. Every seed
comes from the config's seed and the cell's index (AGENTS.md rule 6), so the
result does not depend on how the cells are spread over processes.
"""

from __future__ import annotations

import argparse
import os
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from concurrent.futures import ProcessPoolExecutor
from itertools import product
from multiprocessing import Manager
from pathlib import Path
from typing import Any, cast

from analysis.power import (
    SEED_MODELS,
    Cell,
    PowerPoint,
    SeedModel,
    choose_rung,
    composite_sup,
    difference_distribution,
    ladder,
    lattice_level,
    normal_approx_items,
    power_at,
    round_up,
    smallest_passing,
    start_rung,
)
from scripts.results_io import load_config, write_result

_SHARED: MutableMapping[tuple[int, float, float], dict[str, Any]] | None = None
"""The composite-null suprema the worker processes have computed, shared between them."""


def _share(table: MutableMapping[tuple[int, float, float], dict[str, Any]]) -> None:
    global _SHARED
    _SHARED = table


def shared_sup(items: int, margin: float, alpha: float) -> dict[str, Any]:
    """`composite_sup` through a table every worker reads and fills.

    The supremum depends only on (items, margin, alpha), so the cells of a
    margin share it; it is deterministic, so two workers racing on one key
    cost time, not a different result.
    """
    key = (items, margin, alpha)
    if _SHARED is not None and (found := _SHARED.get(key)) is not None:
        return dict(found)
    sup = composite_sup(items, margin, alpha)
    if _SHARED is not None:
        _SHARED[key] = sup
    return sup


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
            sup = shared_sup(items, cell.margin, alpha)
            own = {
                f"{model}, kappa {k:g}": round_up(
                    lattice_level(
                        items,
                        cell.margin,
                        alpha,
                        difference_distribution(
                            (cell.rate, cell.rate + cell.margin), k, model, cell.seeds
                        ),
                    )
                )
                for model in SEED_MODELS
                for k in kappas
            }
            worst = max(own, key=lambda key: own[key])
            fails = [
                *(["composite null"] if sup["level"] > alpha else []),
                *(["own distributions"] if own[worst] > alpha else []),
            ]
            levels[items] = {
                "composite_sup": sup,
                "own_max": own[worst],
                "own_max_at": worst,
                "fails": fails,
                "holds": not fails,
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
        below_level = None if r is None or r == 0 else levels.get(rungs[r - 1])
        if chosen is None:
            set_by = None
        elif below is None or below.power < target:
            set_by = "power"
        else:
            set_by = ", ".join(below_level["fails"]) if below_level else "power"
        targets[str(families)] = {
            "families": int(families),
            "target_power": target,
            "normal_approx_items_joint": approx,
            "items": chosen,
            "power": None if chosen is None else confirm[chosen].power,
            "pair_power": None if chosen is None else confirm[chosen].pair_power,
            "power_one_rung_below": None if below is None else below.power,
            "level_one_rung_below": below_level,
            "set_by": set_by,
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
    workers = max(1, min(len(jobs), os.cpu_count() or 1))
    with (
        Manager() as manager,
        ProcessPoolExecutor(workers, initializer=_share, initargs=(manager.dict(),)) as pool,
    ):
        grid = list(pool.map(_cell_job, jobs))
    keys = (
        "arms",
        "seeds_per_item",
        "families",
        "alphas",
        "level_kappas",
        "simulations_walk",
        "simulations_confirm",
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
