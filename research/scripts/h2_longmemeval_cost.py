"""H2's LongMemEval baselines priced: C2 and C5 at preset medium on each candidate model.

Usage:
    uv run python research/scripts/h2_longmemeval_cost.py \\
        --config research/configs/h2-longmemeval-cost.json \\
        --out research/results/h2-longmemeval-cost.json

Card B6: the sessions `make run CONFIG=<config> COUNT=1` reports for each of
the two baseline configs (research/configs/h2-longmemeval-c2.json and
h2-longmemeval-c5-medium.json), times the calls and tokens per session
measured from the committed fixture cassettes of the same conditions on the
same store (fixtures/cassettes/b5-longmemeval-plane), priced from pi-ai's
catalogue at its pinned version, with the judge priced beside it. Nothing
here calls a model or reads a key.

This extends H1's cost table and does not reimplement it: the session model
(one read, then the answer; r reads in the high estimate), the pricing, the
reasoning budgets and the anomaly flag are research/scripts/h1_cost.py's
functions, and the measured shapes come from
packages/runner/scripts/cost-shapes.ts (`--longmemeval`, the sizes per
question of packages/runner/src/research/cost-shapes.ts
longMemEvalPromptChars) and packages/runner/scripts/run.ts --count. What is
LongMemEval's own:

- the full set's memory per read is what each condition's read shows for the
  question's own text on the S split (C2 the pipeline's top 20 of every turn;
  C5 the same over what preset medium admits at B5's read time, so the clock
  problem of research/results/h2-longmemeval-ttl.json is in it); the
  fixture's tokens per item are moved by the difference between the S
  split's characters per shown item and the fixture reads', over four, and
  the reader prompt and the judge's prompt the same way (P4A-8);
- the judge (upstream's evaluate_qa.py) makes one call per session in both
  estimates; its prompt holds the reader's answer, which the fixture's
  scripted answers keep short.

The S split is card L2's file, checked against its pinned sha256 and fetched
when missing and allowed (research/scripts/h3_fault_set.py ensure_pinned_file).
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from statistics import fmean
from typing import Any

from scripts.h1_cost import (
    CHARS_PER_TOKEN,
    MILLION,
    SHAPES,
    _count,
    candidate_costs,
    fixture_shape,
    price_anomaly,
    session_tokens,
    workload_tokens,
)
from scripts.h3_fault_set import ensure_pinned_file
from scripts.results_io import REPO, load_config, run_node, write_result

CONDITIONS = ("C2", "C5")
CATALOGUE_FIELDS = (
    "api",
    "accepted",
    "found",
    "reasoning",
    "off_effort",
    "can_turn_reasoning_off",
    "input_per_million",
    "output_per_million",
    "cache_read_per_million",
)


def shapes_for(config: Mapping[str, Any], data: Path, models: Sequence[str]) -> dict[str, Any]:
    """The cassette shapes, LongMemEval's sizes per question and the catalogue (cost-shapes.ts)."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "shapes.json"
        run_node(
            [
                SHAPES,
                "--cassettes",
                str(config["cassettes"]),
                "--judge",
                str(config["fixture_judge"]),
                "--longmemeval",
                f"full={data}",
                "--longmemeval",
                f"fixture={config['fixture_data']}",
                "--preset",
                str(config["preset"]),
                "--read-limit",
                str(int(config["read_limit"])),
                "--models",
                ",".join(models),
                "--out",
                str(out),
            ]
        )
        result: dict[str, Any] = json.loads(out.read_text(encoding="utf-8"))
    return result


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = ensure_pinned_file(dict(config["data"]), fetch=bool(config.get("fetch", False)))
    arms = config["arms"]
    estimates = config["estimates"]
    candidates = json.loads((REPO / str(config["candidates_from"])).read_text(encoding="utf-8"))[
        "candidates"
    ]
    with tempfile.TemporaryDirectory() as tmp:
        counts = {name: _count(str(arm["config"]), Path(tmp)) for name, arm in arms.items()}
    for name, count in counts.items():
        if count["data"]["set"] != "full" or count["preset"] != config["preset"]:
            raise ValueError(f"{name}: not counted on the pinned S split at the config's preset")
    judges = {str(c["judge"]["model"]) for c in counts.values()}
    stores = {s for c in counts.values() for s in c["stores"]}
    if len(judges) != 1 or len(stores) != 1:
        raise ValueError("the two baselines must share one judge and one store")
    judge_model, store = judges.pop(), stores.pop()
    models = [*(str(c["model"]) for c in candidates), judge_model]
    shapes = shapes_for(config, data, models)
    catalogue = {e["model"]: e for e in shapes["catalogue"]}

    cassette = shapes["cassettes"][Path(str(config["cassettes"])).name]
    sessions = [s for s in cassette["sessions"] if s["store"] == store]
    fixture = {p["question_id"]: p for p in shapes["longmemeval"]["fixture"]}
    full = shapes["longmemeval"]["full"]
    used = sorted({s["item"].removeprefix("longmemeval/") for s in sessions})
    prompt_fixture = fmean(fixture[q]["chars"] for q in used)
    prompt_full = fmean(p["chars"] for p in full)
    prompt_delta = (prompt_full - prompt_fixture) / CHARS_PER_TOKEN

    measured: dict[str, Any] = {
        "store": store,
        "fixture_questions": used,
        "prompt_chars_fixture": prompt_fixture,
        "prompt_chars_full_set": prompt_full,
        "full_set": {
            "questions": len(full),
            "turns": sum(int(p["turns"]) for p in full),
            "turn_chars_per_question": fmean(float(p["turn_chars"]) for p in full),
        },
    }
    workloads: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for name, arm in arms.items():
        condition = str(arm["condition"])
        if condition not in CONDITIONS or counts[name]["conditions"] != [condition]:
            raise ValueError(f"{name}: one of {CONDITIONS} only, as its config names it")
        shape = fixture_shape([s for s in sessions if s["condition"] == condition])
        shown_items = sum(int(p["shown"][condition]["items"]) for p in full)
        shown_chars = sum(int(p["shown"][condition]["chars"]) for p in full)
        items = shown_items / len(full)
        chars_per_item = shown_chars / shown_items if shown_items else 0.0
        item_delta = (chars_per_item - shape["text_chars_per_item"]) / CHARS_PER_TOKEN
        n = int(counts[name]["per_condition"][condition])
        per: dict[str, Any] = {
            "sessions": n,
            "items_per_read": items,
            "text_chars_per_item": chars_per_item,
            "item_tokens_delta": item_delta,
            "prompt_delta": prompt_delta,
        }
        workloads[name] = {}
        for est, settings in estimates.items():
            tokens = session_tokens(
                shape,
                items_per_read=items,
                prompt_delta=prompt_delta,
                extra_reads=int(settings["extra_read_turns"]),
                item_delta=item_delta,
            )
            per[est] = tokens
            workloads[name][est] = [
                {"sessions": n, "tokens": tokens, "scale": settings["token_scale"]}
            ]
        measured[name] = {"condition": condition, "fixture": shape, "full_set": per}

    # The judge: one call per session (evaluate_qa.py); its prompt moved to the full set's mean.
    judge_calls = [j for j in cassette["judge"] if j["store"] == store]
    judge_fixture = fmean(fixture[q]["judge_chars"] for q in used)
    judge_full = fmean(float(p["judge_chars"]) for p in full)
    judge_shape = {
        "calls": 1,
        "input": fmean(float(j["input_tokens"]) for j in judge_calls)
        + (judge_full - judge_fixture) / CHARS_PER_TOKEN,
        "output": fmean(float(j["output_tokens"]) for j in judge_calls),
    }
    measured["judge"] = {
        **judge_shape,
        "prompt_chars_fixture": judge_fixture,
        "prompt_chars_full_set": judge_full,
    }
    judge_workloads = {
        f"judge_{name}": {
            est: [
                {
                    "sessions": int(counts[name]["judge"]["calls_max"]),
                    "tokens": judge_shape,
                    "scale": settings["token_scale"],
                }
            ]
            for est, settings in estimates.items()
        }
        for name in arms
    }
    judge_entry = catalogue[judge_model]
    judge_cost = candidate_costs(judge_entry, judge_workloads, estimates)

    answer_calls = {
        est: sum(workload_tokens(workloads[name][est])["calls"] for name in arms)
        for est in estimates
    }
    table = []
    for c in candidates:
        entry = catalogue[str(c["model"])]
        costs = candidate_costs(entry, workloads, estimates)
        row: dict[str, Any] = {
            **{k: c[k] for k in ("model", "maker", "tier")},
            "candidate": bool(c.get("candidate", True)),
            "why_not": c.get("why_not"),
            **{k: entry[k] for k in CATALOGUE_FIELDS},
            "price_anomaly": price_anomaly(entry),
            "cost": costs,
            "reasoning_cost_per_1000_tokens_per_call": None
            if costs is None or not entry["reasoning"]
            else {
                est: answer_calls[est] * 1000 * float(entry["output_per_million"]) / MILLION
                for est in sorted(estimates)
            },
        }
        if costs is not None and judge_cost is not None:
            row["total_with_judge"] = {
                est: sum(costs[name][est] + judge_cost[f"judge_{name}"][est] for name in arms)
                for est in sorted(estimates)
            }
        table.append(row)

    return {
        "name": config["name"],
        "hypothesis": "H2",
        "benchmark": "longmemeval",
        "preset": config["preset"],
        "prices": {
            **shapes["snapshot"],
            "provider": "openrouter",
            "unit": "US dollars per million tokens (pi-ai catalogue cost.input, cost.output)",
        },
        "data": {k: config["data"][k] for k in ("dataset", "revision", "file", "sha256")},
        "sizes": {
            name: {
                k: counts[name][k]
                for k in ("config", "items", "item_kinds", "per_condition", "sessions", "seeds")
            }
            | {"judge": counts[name]["judge"], "stores": counts[name]["stores"]}
            for name in sorted(counts)
        },
        "inputs": {
            "cassettes": str(config["cassettes"]),
            "fixture_data": str(config["fixture_data"]),
            "candidates_from": str(config["candidates_from"]),
        },
        "estimates": estimates,
        "assumptions": config["assumptions"],
        "measured": measured,
        "tokens": {
            name: {est: workload_tokens(groups) for est, groups in sorted(by_est.items())}
            for name, by_est in sorted({**workloads, **judge_workloads}.items())
        },
        "judge": {
            "model": judge_model,
            **{k: judge_entry[k] for k in ("api", "accepted", "reasoning")},
            "input_per_million": judge_entry["input_per_million"],
            "output_per_million": judge_entry["output_per_million"],
            "cost": judge_cost,
        },
        "candidates": table,
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
