"""What the pre-tag live checks cost: the smoke run and the B1 reference run.

Usage:
    uv run python research/scripts/h1_check_runs_cost.py \\
        --config research/configs/h1-check-runs-cost.json \\
        --out research/results/h1-check-runs-cost.json

Card RV6 (design review RV-DES-9). The two checks run before the tag and are
never analysed, but they are paid for, so the lead sees their price first.
They are priced with H1's cost code and H1's measured shapes, nothing new:

- each config's sessions per condition and item kind, its judge calls (one
  to three per GateMem session) and its agent notes, from
  `make run CONFIG=<config> COUNT=1` (packages/runner/scripts/run.ts --count);
- per session of C2 to C5, the tokens research/results/h1-cost.json measured
  for that condition and item kind on the pinned full set (GateMem) or the
  case set (MEM-INV-Bench), low and high, and the judge's and the agent
  note's tokens per call, from the same file (its sha256 is recorded);
- per session of C1, which is one answer call with the long-context prompt:
  the characters of each item's own C1 prompt over four
  (packages/runner/scripts/check-runs.ts c1-chars), plus what the fixture C1
  sessions' cassettes hold beyond their prompts (the transcript's framing),
  and the fixture C1 answer's output tokens; the high estimate scales both
  by H1's token scale;
- prices, the reasoning flag and whether thinking off is honoured, from
  pi-ai's built-in catalogue (packages/runner/scripts/cost-shapes.ts), and
  the reasoning tokens per answer call H1's estimates assume;
- the pricing itself is h1_cost.py's (`price`, `workload_cost`,
  `reasoning_budget`), imported, not rewritten.

Nothing here calls a model or reads a key.
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
    GATEMEM_KINDS,
    SHAPES,
    _count,
    reasoning_budget,
    workload_cost,
    workload_tokens,
)
from scripts.results_io import REPO, load_config, run_node, sha256_file, write_result

CHECK_RUNS = "packages/runner/scripts/check-runs.ts"


def _c1_prompts(config_path: str, tmp: Path) -> list[dict[str, Any]]:
    """Each item's C1 prompt characters and kind (check-runs.ts c1-chars)."""
    out = tmp / f"c1-{Path(config_path).stem}.json"
    run_node([CHECK_RUNS, "c1-chars", "--config", config_path, "--out", str(out)])
    return list(json.loads(out.read_text("utf-8")))


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    h1_path = REPO / str(config["h1_cost"])
    h1 = json.loads(h1_path.read_text(encoding="utf-8"))
    estimates = h1["estimates"]
    measured = h1["measured"]
    runs = list(config["runs"])
    judge_model = str(config["judge_model"])
    models = sorted({str(r["model"]) for r in runs} | {judge_model})
    fixture = config["c1_fixture"]
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        shapes_out = tmp / "shapes.json"
        run_node(
            [
                SHAPES,
                "--cassettes",
                str(fixture["cassettes"]),
                "--judge",
                str(fixture["judge"]),
                "--prompts",
                f"fixture={fixture['data']}",
                "--models",
                ",".join(models),
                "--out",
                str(shapes_out),
            ]
        )
        shapes = json.loads(shapes_out.read_text(encoding="utf-8"))
        fixture_chars = {
            str(r["checkpoint_id"]): int(r["chars"])
            for r in _c1_prompts(str(fixture["config"]), tmp)
        }
        counts = {str(r["config"]): _count(str(r["config"]), tmp) for r in runs}
        c1: dict[str, dict[str, list[int]]] = {}
        for r in runs:
            path = str(r["config"])
            if "C1" in counts[path]["conditions"]:
                for p in _c1_prompts(path, tmp):
                    c1.setdefault(path, {}).setdefault(str(p["kind"]), []).append(int(p["chars"]))
    catalogue = {e["model"]: e for e in shapes["catalogue"]}

    # C1's fixture sessions: what the cassette holds beyond the prompt, and the answer's size.
    c1_sessions = [
        s
        for s in shapes["cassettes"][Path(str(fixture["cassettes"])).name]["sessions"]
        if s["condition"] == "C1"
    ]
    framing = fmean(
        float(s["calls"][0]["input_tokens"])
        - fixture_chars[s["item"].removeprefix("gatemem/")] / CHARS_PER_TOKEN
        for s in c1_sessions
    )
    c1_out = fmean(float(s["calls"][0]["output_tokens"]) for s in c1_sessions)
    measured_c1 = {
        "fixture_sessions": len(c1_sessions),
        "framing_tokens": framing,
        "answer_output_tokens": c1_out,
    }

    judge_entry = catalogue[judge_model]
    rows = []
    for run in runs:
        path = str(run["config"])
        count = counts[path]
        entry = catalogue[str(run["model"])]
        answer: dict[str, list[dict[str, Any]]] = {est: [] for est in estimates}
        judge: dict[str, list[dict[str, Any]]] = {est: [] for est in estimates}
        per_cell = len(count["stores"]) * len(count["seeds"])
        for condition in count["conditions"]:
            cells = len(count["seeds"]) if condition == "C1" else per_cell
            if count["benchmark"] == "gatemem":
                for label, kind in GATEMEM_KINDS.items():
                    n = int(count["item_kinds"].get(label, 0))
                    if n == 0:
                        continue
                    for est, settings in estimates.items():
                        scale = float(settings["token_scale"])
                        if condition == "C1":
                            chars = c1[path][kind]
                            tokens = {
                                "calls": 1,
                                "input": fmean(chars) / CHARS_PER_TOKEN + framing,
                                "output": c1_out,
                            }
                        else:
                            tokens = measured["gatemem"][condition]["full_set"][kind][est]
                        answer[est].append(
                            {"sessions": n * cells, "tokens": tokens, "scale": scale}
                        )
            else:
                n = int(count["items"])
                for est, settings in estimates.items():
                    tokens = measured["mem-inv-bench"][condition]["full_set"][est]
                    answer[est].append(
                        {
                            "sessions": n * cells,
                            "tokens": tokens,
                            "scale": float(settings["token_scale"]),
                        }
                    )
        note = measured["mem-inv-bench"]["note"]
        for est, settings in estimates.items():
            scale = float(settings["token_scale"])
            if int(count["note_calls"]) > 0:
                limit = settings.get("note_output_tokens")
                answer[est].append(
                    {
                        "sessions": int(count["note_calls"]),
                        "tokens": {
                            "calls": 1,
                            "input": float(note["input"]) * scale,
                            "output": float(note["output"]) * scale
                            if limit is None
                            else float(limit),
                        },
                        "scale": 1.0,
                    }
                )
            if "judge" in count:
                calls = int(count["judge"][f"calls_{settings['judge_calls']}"])
                judge[est].append({"sessions": calls, "tokens": measured["judge"], "scale": scale})
        cost = {
            est: workload_cost(answer[est], entry, reasoning_budget(entry, estimates[est]))
            for est in sorted(estimates)
        }
        judge_cost = {est: workload_cost(judge[est], judge_entry, 0.0) for est in sorted(estimates)}
        rows.append(
            {
                "config": path,
                "name": count["config"],
                "benchmark": count["benchmark"],
                "model": run["model"],
                "sessions": count["sessions"],
                "per_condition": count["per_condition"],
                "item_kinds": count["item_kinds"],
                "note_calls": count["note_calls"],
                **({"judge_calls": count["judge"]} if "judge" in count else {}),
                "tokens": {est: workload_tokens(answer[est]) for est in sorted(estimates)},
                "judge_tokens": {est: workload_tokens(judge[est]) for est in sorted(estimates)},
                "cost": cost,
                "judge_cost": judge_cost,
                "total": {est: cost[est] + judge_cost[est] for est in sorted(estimates)},
            }
        )
    return {
        "name": config["name"],
        "prices": {
            **shapes["snapshot"],
            "provider": "openrouter",
            "unit": "US dollars per million tokens (pi-ai catalogue cost.input, cost.output)",
        },
        "models": {
            m: {
                k: catalogue[m][k]
                for k in (
                    "api",
                    "accepted",
                    "reasoning",
                    "can_turn_reasoning_off",
                    "input_per_million",
                    "output_per_million",
                )
            }
            for m in models
        },
        "inputs": {"h1_cost": {"file": str(config["h1_cost"]), "sha256": sha256_file(h1_path)}},
        "estimates": estimates,
        "assumptions": config["assumptions"],
        "measured_c1": measured_c1,
        "runs": rows,
        "total": {est: sum(r["total"][est] for r in rows) for est in sorted(estimates)},
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
