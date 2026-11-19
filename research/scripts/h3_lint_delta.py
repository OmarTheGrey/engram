"""H3's model-based delta (card L4): what card L3's model lints add to the floor, per class.

Usage:
    uv run python research/scripts/h3_lint_delta.py \\
        --config research/configs/h3-lint-delta.json \\
        --out research/results/h3-lint-delta.json

The config names a fault-set runner config (`runner_config`, benchmark
`fault-set`) and, for an experiment, the model that filled its slot
(`model`). The script replays that run from its cassettes with
packages/runner/scripts/run.ts under ENGRAM_OFFLINE=1 (`--replay --model
<model>` for an experiment, whose cassettes `make run ... LIVE=1` recorded;
the config's own committed cassettes for a pipeline config), so it calls no
model and fails on a miss or on any new call. Every row is one state linted
at one seed by both tiers in one Plane.lint; scripts/lint_scores.py joins
them with the set's labels. When the config names card L2's result
(`fault_set_result`), the set's files are checked against its hashes first.

Per seed, for the deterministic tier alone, the model tier alone and both
(a label is flagged when either tier flags it): recall and labelled precision
per class (keyed, unkeyed, pooled), subtype and variant, with Wilson
intervals, the unverified findings and the precision bound they give; the
delta, both tiers minus the deterministic tier; per model lint, its own
labels' cells and where else it flagged; and per labelled unit, what the
model said (flag, pass, refused, malformed, or not sent). Across seeds: each
label's flag averaged over the seeds (the unit of analysis is the item,
averaged over seeds before any interval), the recall it gives with a Wilson
interval, and the spread of each per-seed recall, precision and delta (mean,
sample standard deviation, minimum, maximum).

A scripted run (a pipeline config) is never written under research/results:
its numbers prove the pipeline and are not results (AGENTS.md rule 9).
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.lint_scores import (
    CLASSES,
    KEYS,
    TIERS,
    Flags,
    by_question,
    flags_of,
    groups,
    hits,
    label_unit,
    lint_scores,
    read_jsonl,
    tier_scores,
)
from scripts.results_io import REPO, load_config, sha256_file, write_result

ENTRY = "packages/runner/scripts/run.ts"
CHECKED = ("policy.json", "states.jsonl", "labels.jsonl")
MODEL_LINTS = ("contradiction", "unsupported-claim")
OUTCOMES = ("flag", "pass", "refused", "malformed", "not_sent")
COMBOS = {"deterministic": ["deterministic"], "model": ["model"], "both": list(TIERS)}

Row = Mapping[str, Any]


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


def _value(cell: Mapping[str, Any], metric: str) -> float | None:
    v = cell[metric]["value"]
    return None if v is None else float(v)


def _minus(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else a - b


def delta(both: Mapping[str, Any], det: Mapping[str, Any]) -> dict[str, Any]:
    """Both tiers minus the deterministic tier: recall and precision per class, subtype, overall."""

    def pair(x: Mapping[str, Any], y: Mapping[str, Any]) -> dict[str, float | None]:
        return {m: _minus(_value(x, m), _value(y, m)) for m in ("recall", "precision")}

    return {
        "by_class": {
            c: {k: pair(both["by_class"][c][k], det["by_class"][c][k]) for k in KEYS}
            for c in CLASSES
        },
        "by_subtype": {
            s: pair(both["by_subtype"][s], det["by_subtype"][s]) for s in sorted(det["by_subtype"])
        },
        "overall": {k: pair(both["overall"][k], det["overall"][k]) for k in KEYS},
    }


def unit_outcomes(labels: Mapping[str, Sequence[Row]], rows: Sequence[Row]) -> dict[str, Any]:
    """Per subtype and kind of the labels about a model lint, what the model said of its unit."""
    said = {
        str(r["question_id"]): {str(j["unit"]): str(j["outcome"]) for j in r["judgments"]}
        for r in rows
    }
    out: dict[str, Any] = {}
    aimed: dict[str, set[str]] = {}
    for q in sorted(labels):
        for la in labels[q]:
            for lint in [*la["expected"]["model"], *la["near_miss_of"]["model"]]:
                unit = label_unit(la, str(lint))
                aimed.setdefault(q, set()).add(unit)
                outcome = said.get(q, {}).get(unit, "not_sent")
                cell = out.setdefault(str(la["subtype"]), {}).setdefault(
                    str(la["kind"]), {o: 0 for o in OUTCOMES}
                )
                cell[outcome] += 1
    other: dict[str, dict[str, int]] = {}
    for q, units in said.items():
        for unit, outcome in units.items():
            if unit not in aimed.get(q, set()):
                lint = unit.split(":", 1)[0]
                other.setdefault(lint, {o: 0 for o in OUTCOMES if o != "not_sent"})[outcome] += 1
    return {"labelled": out, "unlabelled": dict(sorted(other.items()))}


def seed_scores(labels: Mapping[str, Sequence[Row]], rows: Sequence[Row]) -> dict[str, Any]:
    """One seed's rows: every tier combination's cells, the delta, per model lint, per unit."""
    flags: dict[str, Flags] = {}
    base: dict[str, set[str]] = {}
    for r in rows:
        flags[str(r["question_id"])], base[str(r["question_id"])] = flags_of(r["findings"])
    tiers = {name: tier_scores(labels, flags, base, ts) for name, ts in COMBOS.items()}
    return {
        **tiers,
        "delta": delta(tiers["both"], tiers["deterministic"]),
        "by_model_lint": lint_scores(labels, flags, base, "model", MODEL_LINTS),
        "units": unit_outcomes(labels, rows),
    }


def spread(values: Sequence[float | None]) -> dict[str, Any]:
    """Mean, sample standard deviation, minimum and maximum over the seeds a value is defined at."""
    kept = [v for v in values if v is not None]
    return {
        "n": len(kept),
        "mean": statistics.fmean(kept) if kept else None,
        "sd": statistics.stdev(kept) if len(kept) >= 2 else None,
        "min": min(kept) if kept else None,
        "max": max(kept) if kept else None,
    }


def dig(node: Mapping[str, Any], path: Sequence[str]) -> Mapping[str, Any]:
    """The value at `path` in nested mappings."""
    for p in path:
        node = node[p]
    return node


def across_seeds(
    labels: Mapping[str, Sequence[Row]],
    rows: Sequence[Row],
    per_seed: Mapping[str, Mapping[str, Any]],
    seeds: Sequence[int],
) -> dict[str, Any]:
    """Seed-averaged flags per label and their recall, and the spread of every per-seed rate."""
    averaged: dict[str, Any] = {}
    for name, tiers in COMBOS.items():
        shares: dict[int, float] = {}
        order: list[Row] = []
        for s in seeds:
            flags: dict[str, Flags] = {}
            for r in rows:
                if int(r["seed"]) == s:
                    flags[str(r["question_id"])] = flags_of(r["findings"])[0]
            scored = hits(labels, flags, tiers)
            order = [la for la, _ in scored]
            for i, (_, h) in enumerate(scored):
                shares[i] = shares.get(i, 0.0) + (1.0 if h else 0.0) / len(seeds)
        averaged[name] = groups([(la, shares[i]) for i, la in enumerate(order)])
    keys = [str(s) for s in seeds]

    def rates(path: Sequence[str]) -> dict[str, Any]:
        nodes = [dig(per_seed[k], path) for k in keys]
        return {m: spread([_value(n, m) for n in nodes]) for m in ("recall", "precision")}

    def delta_spread(path: Sequence[str]) -> dict[str, Any]:
        nodes = [dig(per_seed[k]["delta"], path) for k in keys]
        return {m: spread([n[m] for n in nodes]) for m in ("recall", "precision")}

    subtypes = sorted(per_seed[keys[0]]["deterministic"]["by_subtype"])
    return {
        "seed_averaged": averaged,
        "spread": {
            name: {
                "by_class": {
                    c: {k: rates([name, "by_class", c, k]) for k in KEYS} for c in CLASSES
                },
                "by_subtype": {s: rates([name, "by_subtype", s]) for s in subtypes},
                "overall": {k: rates([name, "overall", k]) for k in KEYS},
            }
            for name in COMBOS
        },
        "delta_spread": {
            "by_class": {c: {k: delta_spread(["by_class", c, k]) for k in KEYS} for c in CLASSES},
            "by_subtype": {s: delta_spread(["by_subtype", s]) for s in subtypes},
            "overall": {k: delta_spread(["overall", k]) for k in KEYS},
        },
    }


def check_set(data: Path, fault_result: str | None) -> None:
    """The set's files against card L2's committed hashes, when the config names its result."""
    if fault_result is None:
        return
    expected = load_config(REPO / fault_result)["set"]["sha256"]
    for name in CHECKED:
        if not (data / name).exists() or sha256_file(data / name) != expected[name]:
            raise ValueError(f"{data / name} differs from {fault_result}; rebuild the set")


def build(config: Mapping[str, Any]) -> dict[str, Any]:
    runner_path = str(config["runner_config"])
    runner = load_config(REPO / runner_path)
    model = config.get("model")
    if runner.get("benchmark") != "fault-set":
        raise ValueError(f"{runner_path} is not a seeded-fault set config (benchmark fault-set)")
    if runner["kind"] == "experiment" and model is None:
        raise SystemExit(
            f"{runner_path} is an experiment on the model slot {runner['model']}: set `model` in"
            " the config to the provider/model-id that filled it, once its run is recorded"
            f" (make run CONFIG={runner_path} MODEL=<provider/model> LIVE=1)"
        )
    if runner["kind"] != "experiment" and model is not None:
        raise ValueError(f"{runner_path} is a pipeline config; it replays its own cassettes")
    data = ((REPO / runner_path).parent / str(runner["data"])).resolve()
    check_set(data, config.get("fault_set_result"))
    seeds = [int(s) for s in runner["seeds"]]
    with tempfile.TemporaryDirectory(prefix="engram-l4-") as tmp:
        out = Path(tmp)
        replay(runner_path, None if model is None else str(model), out)
        rows = read_jsonl(out / "results.jsonl")
        calls = json.loads((out / "usage.json").read_text(encoding="utf-8"))["calls"]
    if calls["new"] != 0:
        raise RuntimeError(f"the replay made {calls['new']} new model calls; it must make none")
    questions = sorted({str(r["question_id"]) for r in rows})
    labels = {
        q: ls
        for q, ls in by_question(read_jsonl(data / "labels.jsonl")).items()
        if q in set(questions)
    }
    per_seed = {
        str(s): seed_scores(labels, [r for r in rows if int(r["seed"]) == s]) for s in seeds
    }
    floors = {json.dumps(per_seed[str(s)]["deterministic"], sort_keys=True) for s in seeds}
    if len(floors) != 1:
        raise ValueError("the deterministic tier differs between seeds; it calls no model")
    return {
        "name": config["name"],
        "hypothesis": config.get("hypothesis", "H3"),
        "tier": "model",
        "runner_config": runner_path,
        "model": runner["model"] if model is None else model,
        "seeds": seeds,
        "questions": len(questions),
        "labels": sum(len(ls) for ls in labels.values()),
        "calls": {"cached": calls["cached"], "new": calls["new"]},
        "matching": "a tier flags a label when a lint the label names (a fault's expected, a "
        "near-miss's near_miss_of) lands on its finding_on; `both` flags it when either tier "
        "does; delta is both minus deterministic; any other finding is unverified",
        "per_seed": per_seed,
        "across_seeds": across_seeds(labels, rows, per_seed, seeds),
        "upper_bound": "Card L2's limits: every model-tier fault and near-miss is an injected "
        "template sentence that card L3's planning is checked to send, so model recall here "
        "leaves out the pair-selection misses natural prose causes; superseded recall measures "
        "how the model reads L3's contradiction prompt, and is reported apart from conflict.",
        "scripted": str(runner["model"]).startswith("scripted/"),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    runner = load_config(REPO / str(config["runner_config"]))
    results = (REPO / "research" / "results").resolve()
    if str(runner["model"]).startswith("scripted/") and args.out.resolve().is_relative_to(results):
        raise SystemExit(
            f"{args.out} is under research/results, and this run is a scripted model's: its"
            " numbers are not results (AGENTS.md rule 9); write it elsewhere, such as .engram/"
        )
    write_result(args.out, build(config))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
