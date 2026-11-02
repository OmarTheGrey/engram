"""H1's cost table: what H1 costs on each candidate model, from measured shapes.

Usage:
    uv run python research/scripts/h1_cost.py \\
        --config research/configs/h1-cost.json --out research/results/h1-cost.json

Plan decision 7 of docs/tasks/prereg-v1-plan.md: the sessions COUNT reports
for each H1 config, times the calls and tokens per session measured from the
committed fixture cassettes of the same conditions, priced from pi-ai's
catalogue at its pinned version, with GateMem's judge priced beside it.
Nothing here calls a model or reads a key.

What is measured, and where (TypeScript, reached through
packages/runner/scripts/cost-shapes.ts and packages/runner/scripts/run.ts
--count, never reimplemented here):

- the sessions of each arm per condition and item kind, the judge's calls
  (one to three per GateMem session) and MEM-INV-Bench's agent notes:
  `make run CONFIG=<H1 config> COUNT=1`;
- per condition, a fixture session's shape from its cassettes, every token
  count pi's own estimate (characters over four): the prompt (the first
  call's input), the read call (its output, and its size when replayed into
  the next call), the memory_read result (its tokens and the items it shows,
  so tokens per item) and the answer (the last call's output); the judge's
  prompt and verdict; a note's prompt and reply;
- the GateMem probe's prompt per checkpoint, on the fixture's checkpoints and
  on the pinned full set, so the prompt is moved to the full set's size;
- items per read on the full set: on GateMem from research/results/h1-c4-walk.json
  (C2 and C3 show C3's list, C4 its walk, C5 C5's list, each checkpoint's own
  question), on MEM-INV-Bench from research/results/h1-mem-inv-admission.json
  (C2 to C4 hold every entry; C5 reads what the preset admits);
- each candidate's API, prices per million tokens and reasoning flag from
  pi-ai's built-in catalogue, and whether the runner's answer path accepts
  it (an API that carries the seed).

The session model. The scripted cassettes make one read, then answer: a
session is the read call (input: the prompt; output: the tool call) and the
answer call (input: the prompt, the tool call and the read result). With r
reads a session has r + 1 calls, call i carrying the prompt and i earlier
calls and results:

    input  = (r + 1) * prompt + (call_in + read) * r * (r + 1) / 2
    output = r * call_out + answer_out

where `read` is the full set's items per read times the fixture's tokens per
item, and the prompt is the fixture's plus the full set's extra characters
over four. The low estimate takes r = 1 (the fixture's own shape) at pi's
four characters per token; the high one takes the config's extra read turns,
three characters per token, the judge's three attempts, the note's token
limit, and a reasoning budget per answer call for every model the catalogue
marks as reasoning (the runner asks for thinking `off`, so the low estimate
counts none). Every assumption is in the config and in the result.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from statistics import fmean
from typing import Any

from scripts.results_io import (
    REPO,
    ensure_pinned_gatemem,
    load_config,
    run_node,
    sha256_file,
    write_result,
)

SHAPES = "packages/runner/scripts/cost-shapes.ts"
RUN = "packages/runner/scripts/run.ts"
MILLION = 1_000_000
# COUNT's item kinds, as the walk result names them (GateMem's query types).
GATEMEM_KINDS = {"access control": "privacy", "active forgetting": "safety", "utility": "utility"}
VIOLATION_KINDS = ("privacy", "safety")
# What each condition's read shows on the full set, by the walk result's list names.
WALK_LIST = {"C2": "c3", "C3": "c3", "C4": "c4", "C5": "c5"}


def fixture_shape(sessions: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """The mean shape of a condition's fixture sessions: one read call, then the answer."""
    rows = []
    for s in sessions:
        calls = s["calls"]
        reads = calls[-1]["reads"] if calls else []
        if len(calls) != 2 or len(reads) != 1 or calls[0]["reads"]:
            raise ValueError("a fixture session must be one read, then the answer")
        first, last = calls
        read = reads[0]
        rows.append(
            {
                "prompt": first["input_tokens"],
                "call_out": first["output_tokens"],
                "call_in": last["input_tokens"] - first["input_tokens"] - read["tokens"],
                "read_tokens": read["tokens"],
                "read_items": read["items"],
                "answer_out": last["output_tokens"],
            }
        )
    shape: dict[str, Any] = {k: fmean(float(r[k]) for r in rows) for k in rows[0]}
    items = sum(r["read_items"] for r in rows)
    shape["tokens_per_item"] = sum(r["read_tokens"] for r in rows) / items if items else 0.0
    shape["sessions"] = len(rows)
    return shape


def session_tokens(
    shape: Mapping[str, Any], *, items_per_read: float, prompt_delta: float, extra_reads: int
) -> dict[str, float | int]:
    """One session's calls and tokens with the full set's memory and prompt (module docstring)."""
    r = 1 + extra_reads
    prompt = float(shape["prompt"]) + prompt_delta
    read = items_per_read * float(shape["tokens_per_item"])
    return {
        "calls": r + 1,
        "input": (r + 1) * prompt + (float(shape["call_in"]) + read) * r * (r + 1) / 2,
        "output": r * float(shape["call_out"]) + float(shape["answer_out"]),
    }


def price(
    tokens: Mapping[str, float | int],
    scale: float,
    entry: Mapping[str, Any],
    *,
    reasoning_per_call: float,
) -> float:
    """US dollars for `tokens` at `scale`, with reasoning output per call for a reasoning model."""
    reasoning = float(tokens["calls"]) * reasoning_per_call if entry["reasoning"] else 0.0
    return (
        float(tokens["input"]) * scale * float(entry["input_per_million"])
        + (float(tokens["output"]) * scale + reasoning) * float(entry["output_per_million"])
    ) / MILLION


def workload_cost(
    groups: Sequence[Mapping[str, Any]], entry: Mapping[str, Any], reasoning_per_call: float
) -> float:
    return sum(
        int(g["sessions"])
        * price(g["tokens"], float(g["scale"]), entry, reasoning_per_call=reasoning_per_call)
        for g in groups
    )


def workload_tokens(groups: Sequence[Mapping[str, Any]]) -> dict[str, float]:
    """Calls and tokens in all (reasoning excluded: it depends on the model)."""
    return {
        "calls": float(sum(int(g["sessions"]) * float(g["tokens"]["calls"]) for g in groups)),
        "input": sum(
            int(g["sessions"]) * float(g["tokens"]["input"]) * float(g["scale"]) for g in groups
        ),
        "output": sum(
            int(g["sessions"]) * float(g["tokens"]["output"]) * float(g["scale"]) for g in groups
        ),
    }


def candidate_costs(
    entry: Mapping[str, Any],
    workloads: Mapping[str, Mapping[str, Sequence[Mapping[str, Any]]]],
    estimates: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any] | None:
    """Low and high cost of each workload on one candidate; None for a model the runner refuses."""
    if not entry.get("accepted"):
        return None
    return {
        name: {
            est: workload_cost(
                by_estimate[est], entry, float(estimates[est]["reasoning_tokens_per_call"])
            )
            for est in sorted(by_estimate)
        }
        for name, by_estimate in workloads.items()
    }


def _count(config_path: str, tmp: Path) -> dict[str, Any]:
    out = tmp / Path(config_path).stem
    run_node([RUN, "--config", config_path, "--out", str(out), "--count"])
    return dict(json.loads((out / "count.json").read_text(encoding="utf-8")))


def _cases(admission: Mapping[str, Any], preset: str) -> tuple[int, int, int]:
    """Cases, entries written, and entries the preset's action-time read returns."""
    p = admission["by_preset"][preset]
    cases = sum(int(f["cases"]) for f in p["families"].values())
    scopes = p["entries_by_scope"].values()
    return cases, sum(int(s["entries"]) for s in scopes), sum(int(s["admitted"]) for s in scopes)


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = config["gatemem_data"]
    commit = ensure_pinned_gatemem(
        REPO / str(data["full"]), REPO / str(data["manifest"]), fetch=bool(data["fetch"])
    )
    arms = config["arms"]
    candidates = list(config["candidates"])
    estimates = config["estimates"]
    with tempfile.TemporaryDirectory() as tmp:
        counts = {name: _count(str(arm["config"]), Path(tmp)) for name, arm in arms.items()}
        judge_model = str(counts["gatemem"]["judge"]["model"])
        shapes_out = Path(tmp) / "shapes.json"
        run_node(
            [
                SHAPES,
                *[a for arm in arms.values() for a in ("--cassettes", str(arm["cassettes"]))],
                "--judge",
                str(config["fixture_judge"]),
                "--prompts",
                f"full={data['full']}",
                "--prompts",
                f"fixture={data['fixture']}",
                "--models",
                ",".join([*(str(c["model"]) for c in candidates), judge_model]),
                "--out",
                str(shapes_out),
            ]
        )
        shapes = json.loads(shapes_out.read_text(encoding="utf-8"))
    walk_path, admission_path = REPO / config["walk"], REPO / config["admission"]
    walk = json.loads(walk_path.read_text(encoding="utf-8"))
    admission = json.loads(admission_path.read_text(encoding="utf-8"))
    catalogue = {e["model"]: e for e in shapes["catalogue"]}

    measured: dict[str, Any] = {}
    workloads: dict[str, dict[str, list[dict[str, Any]]]] = {}

    # GateMem: per condition and item kind.
    gm = counts["gatemem"]
    gm_cassette = Path(arms["gatemem"]["cassettes"]).name
    gm_sessions = shapes["cassettes"][gm_cassette]["sessions"]
    fixture_prompts = {p["checkpoint_id"]: p["chars"] for p in shapes["prompts"]["fixture"]}
    used = sorted({s["item"].removeprefix("gatemem/") for s in gm_sessions})
    prompt_fixture = fmean(fixture_prompts[c] for c in used)
    walk_kinds = walk["by_preset"][gm["preset"]]["kinds"]
    per_cell = len(gm["seeds"]) * len(gm["stores"])
    prompt_full = {
        kind: fmean(p["chars"] for p in shapes["prompts"]["full"] if p["kind"] == kind)
        for kind in GATEMEM_KINDS.values()
    }
    measured["gatemem"] = {
        "fixture_checkpoints": used,
        "prompt_chars_fixture": prompt_fixture,
        "prompt_chars_full_set": prompt_full,
    }
    for name in ("gatemem", "gatemem_violation_set"):
        workloads[name] = {est: [] for est in estimates}
    for condition in gm["conditions"]:
        shape = fixture_shape([s for s in gm_sessions if s["condition"] == condition])
        kinds: dict[str, Any] = {}
        for label, kind in GATEMEM_KINDS.items():
            delta = (prompt_full[kind] - prompt_fixture) / 4
            group = walk_kinds[kind]
            items = group["items"][WALK_LIST[condition]] / group["checkpoints"]
            sessions = int(gm["item_kinds"][label]) * per_cell
            kinds[kind] = {"sessions": sessions, "items_per_read": items, "prompt_delta": delta}
            for est, settings in estimates.items():
                tokens = session_tokens(
                    shape,
                    items_per_read=items,
                    prompt_delta=delta,
                    extra_reads=int(settings["extra_read_turns"]),
                )
                kinds[kind][est] = tokens
                g = {"sessions": sessions, "tokens": tokens, "scale": settings["token_scale"]}
                workloads["gatemem"][est].append(g)
                if kind in VIOLATION_KINDS:
                    workloads["gatemem_violation_set"][est].append(g)
        measured["gatemem"][condition] = {"fixture": shape, "full_set": kinds}

    # MEM-INV-Bench: per condition, and the agent notes.
    mi = counts["mem-inv-bench"]
    mi_cassette = Path(arms["mem-inv-bench"]["cassettes"]).name
    mi_shapes = shapes["cassettes"][mi_cassette]
    cases, entries, admitted = _cases(admission, str(mi["preset"]))
    measured["mem-inv-bench"] = {"cases": cases, "entries": entries, "admitted": admitted}
    workloads["mem-inv-bench"] = {est: [] for est in estimates}
    for condition in mi["conditions"]:
        shape = fixture_shape([s for s in mi_shapes["sessions"] if s["condition"] == condition])
        items = (admitted if condition == "C5" else entries) / cases
        per: dict[str, Any] = {"items_per_read": items}
        for est, settings in estimates.items():
            tokens = session_tokens(
                shape,
                items_per_read=items,
                prompt_delta=0.0,
                extra_reads=int(settings["extra_read_turns"]),
            )
            per[est] = tokens
            workloads["mem-inv-bench"][est].append(
                {
                    "sessions": int(mi["per_condition"][condition]),
                    "tokens": tokens,
                    "scale": settings["token_scale"],
                }
            )
        measured["mem-inv-bench"][condition] = {"fixture": shape, "full_set": per}
    notes = mi_shapes["note"]
    note_in = fmean(float(n["input_tokens"]) for n in notes)
    note_out = fmean(float(n["output_tokens"]) for n in notes)
    measured["mem-inv-bench"]["note"] = {"input": note_in, "output": note_out}
    for est, settings in estimates.items():
        limit = settings.get("note_output_tokens")
        tokens = {
            "calls": 1,
            "input": note_in * float(settings["token_scale"]),
            "output": note_out * float(settings["token_scale"]) if limit is None else float(limit),
        }
        workloads["mem-inv-bench"][est].append(
            {"sessions": int(mi["note_calls"]), "tokens": tokens, "scale": 1.0}
        )

    # The judge: every GateMem session, one to three attempts.
    judge_calls = shapes["cassettes"][gm_cassette]["judge"]
    judge_shape = {
        "calls": 1,
        "input": fmean(float(j["input_tokens"]) for j in judge_calls),
        "output": fmean(float(j["output_tokens"]) for j in judge_calls),
    }
    measured["judge"] = judge_shape
    violation_share = sum(gm["item_kinds"][k] for k, v in GATEMEM_KINDS.items() if v != "utility")
    judge_workloads: dict[str, dict[str, list[dict[str, Any]]]] = {
        "judge": {},
        "judge_violation_set": {},
    }
    for est, settings in estimates.items():
        calls = int(gm["judge"][f"calls_{settings['judge_calls']}"])
        scale = float(settings["token_scale"])
        judge_workloads["judge"][est] = [{"sessions": calls, "tokens": judge_shape, "scale": scale}]
        judge_workloads["judge_violation_set"][est] = [
            {
                "sessions": calls * violation_share // int(gm["items"]),
                "tokens": judge_shape,
                "scale": scale,
            }
        ]
    judge_entry = catalogue[judge_model]
    judge_cost = candidate_costs(judge_entry, judge_workloads, estimates)

    table = []
    for c in candidates:
        entry = catalogue[str(c["model"])]
        costs = candidate_costs(entry, workloads, estimates)
        row: dict[str, Any] = {
            **{k: c[k] for k in ("model", "maker", "tier")},
            **{k: entry[k] for k in ("api", "accepted", "found", "reasoning")},
            "input_per_million": entry["input_per_million"],
            "output_per_million": entry["output_per_million"],
            "cost": costs,
        }
        if costs is not None and judge_cost is not None:
            row["total_with_judge"] = {
                est: costs["gatemem"][est] + costs["mem-inv-bench"][est] + judge_cost["judge"][est]
                for est in sorted(estimates)
            }
        table.append(row)

    return {
        "name": config["name"],
        "hypothesis": "H1",
        "prices": {
            **shapes["snapshot"],
            "provider": "openrouter",
            "unit": "US dollars per million tokens (pi-ai catalogue cost.input, cost.output)",
        },
        "sizes": {
            name: {
                k: counts[name][k]
                for k in ("config", "items", "item_kinds", "per_condition", "sessions", "seeds")
            }
            | ({"judge": counts[name]["judge"]} if "judge" in counts[name] else {})
            | {"note_calls": counts[name]["note_calls"]}
            for name in sorted(counts)
        },
        "inputs": {
            "gatemem_commit": commit,
            "cassettes": {name: str(arm["cassettes"]) for name, arm in sorted(arms.items())},
            "walk": {"file": config["walk"], "sha256": sha256_file(walk_path)},
            "admission": {"file": config["admission"], "sha256": sha256_file(admission_path)},
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
