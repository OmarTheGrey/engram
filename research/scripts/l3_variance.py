"""H3's model-based tier: how much the model-based lints vary across seeds (card L3).

Usage:
    uv run python research/scripts/l3_variance.py \\
        --config research/configs/l3-variance.json \\
        --out research/results/l3-variance.json

The config names a lint runner config (`runner_config`, benchmark
`lint-faults`) and, for an experiment, the model that filled its slot
(`model`). The script replays that run from its cassettes with
packages/runner/scripts/run.ts under ENGRAM_OFFLINE=1 (`--replay --model
<model>` for an experiment, whose cassettes `make run ... LIVE=1` recorded;
the config's own committed cassettes for a pipeline config), so it calls no
model and fails on a miss; the lints, the plane and the parsing are
TypeScript and are not reimplemented here. It then aggregates the rows, which
carry each fault fixture's labels beside what the lints found:

- per lint and seed: units sent, their outcomes (flag, pass, refused,
  malformed), item-level true and false positives and false negatives against
  the fixture's flags, precision, recall, the flag rate among judged units,
  the unjudged rate (refused or malformed among units) and the unit accuracy
  (judged units whose verdict is the fixture's declared one);
- across seeds, for each of those rates: the seeds it is defined at, its
  mean, sample standard deviation, minimum and maximum (the seed spread the
  pre-registration's Statistics section asks to report);
- unit agreement: the share of units (by fixture and unit) whose outcome is
  the same at every seed, and the share whose flagged or not flagged state is.

A rate with a zero denominator at a seed is null there and left out of the
spread. The run must have made zero new model calls; the script checks
usage.json and refuses otherwise. A scripted run (a pipeline config) is never
written under research/results: its numbers are not results.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import tempfile
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

ENTRY = "packages/runner/scripts/run.ts"
OUTCOMES = ("flag", "pass", "refused", "malformed")
RATES = ("precision", "recall", "flag_rate", "unjudged_rate", "unit_accuracy")

Row = Mapping[str, Any]


def _ratio(num: int, den: int) -> float | None:
    return num / den if den else None


def seed_stats(rows: Sequence[Row], lint: str, seed: int) -> dict[str, Any]:
    """One lint's counts and rates at one seed, over every fixture of that lint."""
    mine = [r for r in rows if r["lint_id"] == lint and r["seed"] == seed]
    outcomes: Counter[str] = Counter()
    tp = fp = fn = correct = 0
    for r in mine:
        verdicts = {u["unit"]: u["verdict"] for u in r["labels"]["units"]}
        for j in r["judgments"]:
            outcomes[j["outcome"]] += 1
            if j["outcome"] in ("flag", "pass") and verdicts.get(j["unit"]) == j["outcome"]:
                correct += 1
        found = {f["item_id"] for f in r["findings"] if f["lint_id"] == lint}
        truth = set(r["labels"]["flags"])
        tp += len(found & truth)
        fp += len(found - truth)
        fn += len(truth - found)
    units = sum(outcomes.values())
    judged = outcomes["flag"] + outcomes["pass"]
    return {
        "units": units,
        **{o: outcomes[o] for o in OUTCOMES},
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": _ratio(tp, tp + fp),
        "recall": _ratio(tp, tp + fn),
        "flag_rate": _ratio(outcomes["flag"], judged),
        "unjudged_rate": _ratio(outcomes["refused"] + outcomes["malformed"], units),
        "unit_accuracy": _ratio(correct, judged),
    }


def spread(values: Sequence[float | None]) -> dict[str, Any]:
    """Mean, sample standard deviation, minimum and maximum over the seeds a rate is defined at."""
    kept = [v for v in values if v is not None]
    return {
        "n": len(kept),
        "mean": statistics.fmean(kept) if kept else None,
        "sd": statistics.stdev(kept) if len(kept) >= 2 else None,
        "min": min(kept) if kept else None,
        "max": max(kept) if kept else None,
    }


def unit_agreement(rows: Sequence[Row], lint: str, seeds: Sequence[int]) -> dict[str, Any]:
    """How many units, by fixture and unit, every seed answered alike."""
    by_unit: dict[tuple[str, str], dict[int, str]] = {}
    for r in rows:
        if r["lint_id"] != lint:
            continue
        for j in r["judgments"]:
            by_unit.setdefault((r["fixture"], j["unit"]), {})[r["seed"]] = j["outcome"]
    complete = [o for o in by_unit.values() if all(s in o for s in seeds)]
    same = sum(1 for o in complete if len(set(o.values())) == 1)
    same_flag = sum(1 for o in complete if len({v == "flag" for v in o.values()}) == 1)
    return {
        "units": len(complete),
        "incomplete": len(by_unit) - len(complete),
        "same_outcome": same,
        "same_outcome_share": _ratio(same, len(complete)),
        "same_flag": same_flag,
        "same_flag_share": _ratio(same_flag, len(complete)),
    }


def variance(rows: Sequence[Row], seeds: Sequence[int]) -> dict[str, Any]:
    """Every lint's per-seed statistics, their spread across seeds, and unit agreement."""
    out: dict[str, Any] = {}
    for lint in sorted({str(r["lint_id"]) for r in rows}):
        per_seed = {str(s): seed_stats(rows, lint, s) for s in seeds}
        out[lint] = {
            "per_seed": per_seed,
            "across_seeds": {k: spread([per_seed[str(s)][k] for s in seeds]) for k in RATES},
            "unit_agreement": unit_agreement(rows, lint, seeds),
        }
    return out


def replay(runner_config: str, model: str | None, out: Path) -> None:
    """The run, replayed offline from its cassettes; a miss fails."""
    args = ["node", ENTRY, "--config", runner_config, "--out", str(out)]
    if model is not None:
        args += ["--replay", "--model", model]
    subprocess.run(
        args,
        cwd=REPO,
        env={**os.environ, "ENGRAM_OFFLINE": "1"},
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def build(config: Mapping[str, Any]) -> dict[str, Any]:
    runner_path = str(config["runner_config"])
    runner = load_config(REPO / runner_path)
    model = config.get("model")
    if runner.get("benchmark") != "lint-faults":
        raise ValueError(f"{runner_path} is not a lint fault-set config (benchmark lint-faults)")
    if runner["kind"] == "experiment" and model is None:
        raise SystemExit(
            f"{runner_path} is an experiment on the model slot {runner['model']}: set `model` in"
            " the config to the provider/model-id that filled it, once its run is recorded"
            f" (make run CONFIG={runner_path} MODEL=<provider/model> LIVE=1)"
        )
    if runner["kind"] != "experiment" and model is not None:
        raise ValueError(f"{runner_path} is a pipeline config; it replays its own cassettes")
    seeds = [int(s) for s in runner["seeds"]]
    with tempfile.TemporaryDirectory(prefix="engram-l3-") as tmp:
        out = Path(tmp)
        replay(runner_path, None if model is None else str(model), out)
        lines = (out / "results.jsonl").read_text(encoding="utf-8").splitlines()
        rows = [json.loads(line) for line in lines if line]
        calls = json.loads((out / "usage.json").read_text(encoding="utf-8"))["calls"]
    if calls["new"] != 0:
        raise RuntimeError(f"the replay made {calls['new']} new model calls; it must make none")
    fixtures = sorted(
        {(r["fixture"], r["lint_id"], r["kind"]) for r in rows},
    )
    return {
        "name": config["name"],
        "hypothesis": config.get("hypothesis", "H3"),
        "tier": "model",
        "runner_config": runner_path,
        "model": runner["model"] if model is None else model,
        "seeds": seeds,
        "fixtures": [{"name": n, "lint_id": lint, "kind": k} for n, lint, k in fixtures],
        "calls": {"cached": calls["cached"], "new": calls["new"]},
        "lints": variance(rows, seeds),
        "scripted": str(runner["model"]).startswith("scripted/"),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    result = build(load_config(args.config))
    results = (REPO / "research" / "results").resolve()
    if result["scripted"] and args.out.resolve().is_relative_to(results):
        raise SystemExit(
            f"{args.out} is under research/results, and this run is a scripted model's: its"
            " numbers are not results (AGENTS.md rule 9); write it elsewhere, such as .engram/"
        )
    write_result(args.out, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
