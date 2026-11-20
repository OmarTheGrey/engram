"""The full cost table (card RV8, RV-DES-20): every registered run, its calls, tokens and dollars.

Usage:
    uv run python research/scripts/cost_table.py \\
        --config research/configs/cost-table.json --out research/results/cost-table.json

One row per run of the pre-registration, H1 to H5: each benchmark, condition,
preset, store and model role, its seeds, and its judge, simulator or lint calls
as rows of their own. For each row: the sessions, the calls and the prompt and
completion tokens at the low and the high estimate, the dollars on every model
the role may take (lead-decisions item 1) at OpenRouter's list prices on the
day the prices config names, and the RV1 ceiling, the config's
`ceiling_factor` (1.25) times the high estimate. Totals follow for each option
of items 1, 2 and 47, at those prices and at pi-ai 1.3.0's catalogue's.

Where the counts come from, per row (`status` and `count`):

- a run whose config exists (`built`) takes its sessions from what
  `make run CONFIG=<config> COUNT=1` counted, as the committed results
  research/results/h1-cost.json and h2-longmemeval-cost.json record it, and
  H3's model lints from research/results/h3-lint-floor.json (`model_run`);
  L3's pilot is counted here by the runner's own `--count`
  (packages/runner/scripts/run.ts), never by Python;
- every input result is checked against its sha256 in
  research/results/MANIFEST.md, so a stale input is refused;
- a session's tokens come from the shapes those results measured on the
  fixture cassettes and the full sets (research/scripts/h1_cost.py's session
  model); a run not built is `estimated from the design`, its shape from the
  nearest measured condition or from the config's `design_shapes`, each with
  its basis. GateMem's C1 is the long-context agent's prompt, sized here from
  the pinned data: the probe prompt plus the last 300 turns up to the as-of
  turn as JSON items (packages/bench/src/gatemem/agents.ts longContextItems);
  LongMemEval's C1 is the reader prompt plus the whole history.

A row `shared_with` another makes no new call (rule 7) and enters no total,
except as item 2's option (b) says. Nothing here calls a model or reads a key.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from statistics import fmean
from typing import Any

from scripts.results_io import (
    GATEMEM_DOMAINS,
    REPO,
    ensure_pinned_gatemem,
    load_config,
    run_node,
    sha256_file,
    write_result,
)

MILLION = 1_000_000
CHARS_PER_TOKEN = 4.0
ESTIMATES = ("low", "high")
PRESET_FREE = ("C1", "C2")
LME_ARM = {"C2": "c2", "C5": "c5-medium"}
MANIFEST = REPO / "research/results/MANIFEST.md"

Tokens = dict[str, float]
Shape = dict[str, Tokens]


def manifest_hashes() -> dict[str, str]:
    """research/results/MANIFEST.md's sha256 per results file."""
    out: dict[str, str] = {}
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 6 and cells[0].startswith("research/results/"):
            out[cells[0]] = cells[4]
    return out


def load_inputs(spec: Mapping[str, str], root: Path = REPO) -> dict[str, Any]:
    """Each input result, refused when its sha256 is not the manifest's."""
    hashes = manifest_hashes()
    out: dict[str, Any] = {}
    for name, rel in spec.items():
        path = root / rel
        want = hashes.get(rel)
        if want is None:
            raise ValueError(f"{rel} is not in research/results/MANIFEST.md")
        if sha256_file(path) != want:
            raise ValueError(f"{rel}: its sha256 differs from the manifest's; regenerate it first")
        out[name] = json.loads(path.read_text(encoding="utf-8"))
    return out


def lookup(inputs: Mapping[str, Any], ref: str) -> Any:
    """`<input>:<dotted.path>`; a path segment may hold spaces, never a dot."""
    name, _, path = ref.partition(":")
    value: Any = inputs[name]
    for key in path.split("."):
        value = value[key]
    return value


def fill(text: str, values: Mapping[str, str]) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: values[m.group(1)], text)


def _tokens(d: Mapping[str, Any]) -> Tokens:
    return {k: float(d[k]) for k in ("calls", "input", "output")}


# GateMem's long-context condition, sized from the pinned data.


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def c1_gatemem_chars(data: Path, turns: int) -> dict[str, float]:
    """Mean characters of the long-context memory block per checkpoint kind: the last `turns`
    turns up to the as-of turn, each as the JSON item longContextItems builds."""
    sums: dict[str, list[int]] = {}
    for domain in GATEMEM_DOMAINS:
        episodes = {e["episode_id"]: e for e in _read_jsonl(data / domain / "episodes.jsonl")}
        for c in _read_jsonl(data / domain / "checkpoints.jsonl"):
            history = episodes[c["episode_id"]]["turns"]
            ids = [t["turn_id"] for t in history]
            upto = history[: ids.index(c["as_of_turn_id"]) + 1]
            block = sum(
                len(
                    json.dumps(
                        {
                            "record_id": (t.get("record_refs") or [t["turn_id"]])[0],
                            "turn_id": t["turn_id"],
                            "principal_id": t["speaker"]["principal_id"],
                            "role": t["speaker"]["role"],
                            "text": t["text"],
                            "record_refs": t.get("record_refs") or [],
                        },
                        ensure_ascii=False,
                    )
                )
                for t in upto[-turns:]
            )
            sums.setdefault(str(c["query_type"]), []).append(block)
    return {k: fmean(v) for k, v in sorted(sums.items())}


class Shapes:
    """Resolves a run's shape spec to per-session low and high calls and tokens (unscaled)."""

    def __init__(
        self,
        config: Mapping[str, Any],
        inputs: Mapping[str, Any],
        c1_chars: Mapping[str, float],
        counts: Mapping[str, Any],
    ) -> None:
        self.config = config
        self.inputs = inputs
        self.c1_chars = c1_chars
        self.counts = counts

    def resolve(self, spec: Mapping[str, Any], values: Mapping[str, str]) -> Shape:
        if "ref" in spec:
            d = lookup(self.inputs, fill(spec["ref"], values))
            return {e: _tokens(d[e]) for e in ESTIMATES}
        if "single" in spec:
            d = _tokens(lookup(self.inputs, fill(spec["single"], values)))
            return {e: dict(d) for e in ESTIMATES}
        if "envelope" in spec:
            env = spec["envelope"]
            return {e: self.resolve({"ref": env[e]}, values)[e] for e in ESTIMATES}
        if "by_condition" in spec:
            return self.resolve(spec["by_condition"][values["condition"]], values)
        if "mix" in spec:
            parts = [
                (float(self._number(p["weight"])), self.resolve(p["shape"], values))
                for p in spec["mix"]
            ]
            total = sum(w for w, _ in parts)
            return {
                e: {
                    k: sum(w * s[e][k] for w, s in parts) / total
                    for k in ("calls", "input", "output")
                }
                for e in ESTIMATES
            }
        if "design" in spec:
            d = self.config["design_shapes"][spec["design"]]
            return {e: _tokens(d[e]) for e in ESTIMATES}
        if "note" in spec:
            d = lookup(self.inputs, spec["note"])
            out = {}
            for e in ESTIMATES:
                limit = self.config["estimates"][e]["note_output_tokens"]
                scale = float(self.config["estimates"][e]["token_scale"])
                # A token limit is a count, not an estimate: unscaled, as h1_cost.py prices it.
                out[e] = {
                    "calls": 1.0,
                    "input": float(d["input"]),
                    "output": float(d["output"]) if limit is None else float(limit) / scale,
                }
            return out
        if "c1_gatemem" in spec:
            kind = str(spec["c1_gatemem"])
            gm = self.inputs["h1-cost"]["measured"]["gatemem"]
            prompt = float(gm["prompt_chars_full_set"][kind])
            answer = float(gm["C2"]["fixture"]["answer_out"])
            t = {
                "calls": 1.0,
                "input": (prompt + self.c1_chars[kind]) / CHARS_PER_TOKEN,
                "output": answer,
            }
            return {e: dict(t) for e in ESTIMATES}
        if "c1_longmemeval" in spec:
            m = self.inputs["h2-longmemeval-cost"]["measured"]
            chars = float(m["prompt_chars_full_set"]) + float(
                m["full_set"]["turn_chars_per_question"]
            )
            t = {
                "calls": 1.0,
                "input": chars / CHARS_PER_TOKEN,
                "output": float(m["c2"]["fixture"]["answer_out"]),
            }
            return {e: dict(t) for e in ESTIMATES}
        if "lint_model" in spec:
            d = lookup(self.inputs, spec["lint_model"])
            return self._lint(float(d["per_seed"]), float(d["prompt_characters_per_seed"]))
        if "count_lint" in spec:
            c = self.counts[spec["count_lint"]]
            chars = sum(float(f["request_chars"]) for f in c["fixtures"])
            return self._lint(float(c["per_seed"]), chars)
        raise ValueError(f"unknown shape spec {sorted(spec)}")

    def _lint(self, calls: float, chars: float) -> Shape:
        """One seed's lint calls: the counted calls and prompt characters, an assumed reply."""
        return {
            e: {
                "calls": calls,
                "input": chars / CHARS_PER_TOKEN,
                "output": calls * float(self.config["estimates"][e]["lint_output_tokens"]),
            }
            for e in ESTIMATES
        }

    def _number(self, value: Any) -> float:
        return float(lookup(self.inputs, value) if isinstance(value, str) else value)


def cells(run: Mapping[str, Any]) -> Iterator[dict[str, Any]]:
    """The run's (condition, preset, store, role or model) cells; C1 and C2 once over presets."""
    if "arms" in run:
        for arm in run["arms"]:
            yield {
                "condition": arm["condition"],
                "preset": run["preset"],
                "store": arm["store"],
                "role": arm.get("role"),
                "model": arm.get("model"),
                "arm_utility": bool(arm.get("utility", False)),
                "status": arm.get("status", run["status"]),
            }
        return
    roles = run.get("roles") or [run.get("role")]
    for role in roles:
        for condition in run["conditions"]:
            presets = run.get("presets") or [run["preset"]]
            if condition in PRESET_FREE and "presets" in run:
                presets = ["any"]
            for preset in presets:
                yield {
                    "condition": condition,
                    "preset": preset,
                    "store": "none" if condition == "C1" else run["store"],
                    "role": role,
                    "model": run.get("model"),
                    "arm_utility": True,
                    "status": run["status"],
                }


def row_id(run: Mapping[str, Any], cell: Mapping[str, Any]) -> str:
    parts = [str(run["id"]), str(cell["condition"])]
    if cell["preset"] not in ("none", "any") and ("presets" in run or "arms" in run):
        parts.append(str(cell["preset"]))
    if "arms" in run:
        parts.append(str(cell["store"]))
    if cell.get("role") and (run.get("roles") or "arms" in run):
        parts.append(str(cell["role"]))
    return "/".join(parts)


def scaled(t: Tokens, scale: float) -> Tokens:
    return {"calls": t["calls"], "input": t["input"] * scale, "output": t["output"] * scale}


def build_rows(
    config: Mapping[str, Any], inputs: Mapping[str, Any], shapes: Shapes
) -> list[dict[str, Any]]:
    """Every row of the table: one per run cell, and one per cell's judge."""
    est = config["estimates"]
    rows: list[dict[str, Any]] = []
    for run in config["runs"]:
        seeds = len(run["seeds"])
        for cell in cells(run):
            values = {
                "condition": str(cell["condition"]),
                "read_condition": "C2" if cell["condition"] == "C7" else str(cell["condition"]),
                "lme_arm": LME_ARM.get(str(cell["condition"]), ""),
            }
            groups = []
            for g in run["groups"]:
                if g.get("arm_utility") and not cell["arm_utility"]:
                    continue
                items = shapes._number(g["items"])
                shape = shapes.resolve(g["shape"], values)
                groups.append(
                    {
                        "kind": g["kind"],
                        "utility": bool(g.get("utility", False)),
                        "items": int(items),
                        "sessions": int(items) * seeds,
                        "shape": shape,
                    }
                )
            base = {
                "hypothesis": run["hypothesis"],
                "benchmark": run["benchmark"],
                "condition": cell["condition"],
                "preset": cell["preset"],
                "store": cell["store"],
                "seeds": list(run["seeds"]),
                "status": cell["status"],
                "count": run["count"],
                "shared_with": run.get("shared_with"),
            }
            rows.append(
                {
                    **base,
                    "id": row_id(run, cell),
                    "caller": "model under test",
                    "role": cell["role"],
                    "model": cell["model"],
                    "groups": groups,
                    "estimates": {e: dict(est[e]) for e in ESTIMATES},
                }
            )
            judge = run.get("judge")
            if judge:
                jshape = shapes.resolve(judge["shape"], values)
                jgroups = []
                for g in groups:
                    jgroups.append(
                        {
                            "kind": g["kind"],
                            "utility": g["utility"],
                            "items": g["items"],
                            "sessions": g["sessions"],
                            "shape": {
                                e: {
                                    "calls": jshape[e]["calls"] * float(judge["attempts"][e]),
                                    "input": jshape[e]["input"] * float(judge["attempts"][e]),
                                    "output": jshape[e]["output"] * float(judge["attempts"][e]),
                                }
                                for e in ESTIMATES
                            },
                        }
                    )
                rows.append(
                    {
                        **base,
                        "id": row_id(run, cell) + "/judge",
                        "caller": "judge",
                        "role": None,
                        "model": judge["model"],
                        "groups": jgroups,
                        "estimates": {e: dict(est[e]) for e in ESTIMATES},
                    }
                )
    return rows


def group_tokens(group: Mapping[str, Any], e: str, scale: float) -> Tokens:
    t = scaled(group["shape"][e], scale)
    n = float(group["sessions"])
    return {k: t[k] * n for k in ("calls", "input", "output")}


def row_tokens(row: Mapping[str, Any], *, utility: bool = True) -> dict[str, Tokens]:
    """Calls and tokens of a row at each estimate (reasoning excluded: it depends on the model)."""
    out: dict[str, Tokens] = {}
    for e in ESTIMATES:
        scale = float(row["estimates"][e]["token_scale"])
        total = {"calls": 0.0, "input": 0.0, "output": 0.0}
        for g in row["groups"]:
            if g["utility"] and not utility:
                continue
            t = group_tokens(g, e, scale)
            for k in total:
                total[k] += t[k]
        out[e] = total
    return out


def model_flags(config: Mapping[str, Any], inputs: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """Each model's reasoning flags, from pi-ai's catalogue as h1-cost.json gives them."""
    flags: dict[str, dict[str, Any]] = {}
    for c in inputs["h1-cost"]["candidates"]:
        flags[c["model"]] = {
            "reasoning": bool(c.get("reasoning")),
            "can_turn_reasoning_off": c.get("can_turn_reasoning_off"),
        }
    for m in config["non_reasoning"]:
        flags[m] = {"reasoning": False, "can_turn_reasoning_off": None}
    return flags


def price_sets(config: Mapping[str, Any], inputs: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """Per price set: its source and its per-million prices by model."""
    sets: dict[str, dict[str, Any]] = {}
    for rel in config["prices"]:
        p = load_config(REPO / rel)
        sets[str(p["name"])] = {
            "source": p["source"],
            "fetched": p["fetched"],
            "response_sha256": p["response_sha256"],
            "file": rel,
            "models": {
                m: {"input": v["input"], "output": v["output"]} for m, v in p["models"].items()
            },
        }
    h1 = inputs[config["catalogue_prices"]]
    catalogue = {
        c["model"]: {"input": c["input_per_million"], "output": c["output_per_million"]}
        for c in h1["candidates"]
        if c.get("found", True) and c.get("input_per_million") is not None
    }
    catalogue[h1["judge"]["model"]] = {
        "input": h1["judge"]["input_per_million"],
        "output": h1["judge"]["output_per_million"],
    }
    lme_judge = inputs["h2-longmemeval-cost"]["judge"]
    catalogue[lme_judge["model"]] = {
        "input": lme_judge["input_per_million"],
        "output": lme_judge["output_per_million"],
    }
    sets["pi-ai-1.3.0"] = {
        "source": "pi-ai 1.3.0's OpenRouter catalogue, as research/results/h1-cost.json records it",
        "fetched": h1["prices"]["generated_at"][:10],
        "response_sha256": h1["prices"]["openrouter_sha256"],
        "file": config["inputs"][config["catalogue_prices"]],
        "models": catalogue,
    }
    return sets


def dollars(
    row: Mapping[str, Any],
    model: str,
    prices: Mapping[str, Any],
    flags: Mapping[str, Mapping[str, Any]],
    *,
    utility: bool = True,
) -> dict[str, float] | None:
    """Low and high dollars of a row on one model; None where the price set lacks the model."""
    price = prices["models"].get(model)
    if price is None:
        return None
    tokens = row_tokens(row, utility=utility)
    flag = flags.get(model, {"reasoning": False, "can_turn_reasoning_off": None})
    out = {}
    for e in ESTIMATES:
        reasoning = 0.0
        if row["caller"] == "model under test" and flag["reasoning"]:
            budgets = row["estimates"][e]["reasoning_tokens_per_call"]
            off = flag.get("can_turn_reasoning_off")
            reasoning = tokens[e]["calls"] * float(
                budgets["off_honoured" if off is not False else "off_ignored"]
            )
        out[e] = (
            tokens[e]["input"] * float(price["input"])
            + (tokens[e]["output"] + reasoning) * float(price["output"])
        ) / MILLION
    return out


def row_models(row: Mapping[str, Any], options: Mapping[str, Mapping[str, str]]) -> list[str]:
    if row["model"]:
        return [str(row["model"])]
    return sorted({opt[row["role"]] for opt in options.values()})


def resolve_model(row: Mapping[str, Any], option: Mapping[str, str]) -> str:
    return str(row["model"]) if row["model"] else option[row["role"]]


def totals(
    rows: Sequence[Mapping[str, Any]],
    config: Mapping[str, Any],
    sets: Mapping[str, Any],
    flags: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any]:
    """Every option of items 1, 2 and 47, at each price set: dollars and calls, low and high."""
    opts = config["options"]
    share47 = float(opts["item_47"]["b"]["share"])
    out: dict[str, Any] = {}
    for set_name, prices in sorted(sets.items()):
        by_option: dict[str, Any] = {}
        for o1, option in sorted(opts["item_1"].items()):
            for o2 in ("a", "b"):
                for o47 in ("a", "b", "c"):
                    cost = {"low": 0.0, "high": 0.0}
                    calls = {"low": 0.0, "high": 0.0}
                    by_h: dict[str, dict[str, float]] = {}
                    missing: list[str] = []
                    for row in rows:
                        weight = 1.0
                        utility = True
                        if row["shared_with"]:
                            # Shared cells are free, except H2's utility cells when H1 drops them.
                            if not (o2 == "b" and row["shared_with"] == "h1-gatemem"):
                                continue
                            only_utility = [g for g in row["groups"] if g["utility"]]
                            row = {**row, "groups": only_utility}
                        elif o2 == "b" and row["id"].startswith("h1-gatemem/"):
                            utility = False
                        if row["id"].startswith("h3-lint-model/") and o47 == "b":
                            weight = share47
                        model = resolve_model(row, option)
                        d = dollars(row, model, prices, flags, utility=utility)
                        if d is None:
                            missing.append(model)
                            continue
                        t = row_tokens(row, utility=utility)
                        h = by_h.setdefault(row["hypothesis"], {"low": 0.0, "high": 0.0})
                        for e in ESTIMATES:
                            cost[e] += weight * d[e]
                            calls[e] += weight * t[e]["calls"]
                            h[e] += weight * d[e]
                    by_option[f"1{o1}/2{o2}/47{o47}"] = {
                        "dollars": cost,
                        "ceiling": config["ceiling_factor"] * cost["high"],
                        "calls": calls,
                        "by_hypothesis": dict(sorted(by_h.items())),
                        "unpriced_models": sorted(set(missing)),
                    }
        out[set_name] = by_option
    return out


def table(
    rows: Sequence[Mapping[str, Any]],
    config: Mapping[str, Any],
    sets: Mapping[str, Any],
    flags: Mapping[str, Mapping[str, Any]],
    primary: str,
) -> list[dict[str, Any]]:
    """The committed rows: counts, tokens, dollars and ceilings per model at the primary prices."""
    out = []
    for row in rows:
        tokens = row_tokens(row)
        priced = {}
        for model in row_models(row, config["options"]["item_1"]):
            d = dollars(row, model, sets[primary], flags)
            priced[model] = (
                None
                if d is None
                else {
                    "low": d["low"],
                    "high": d["high"],
                    "ceiling": config["ceiling_factor"] * d["high"],
                }
            )
        out.append(
            {
                "id": row["id"],
                "hypothesis": row["hypothesis"],
                "benchmark": row["benchmark"],
                "condition": row["condition"],
                "preset": row["preset"],
                "store": row["store"],
                "seeds": row["seeds"],
                "caller": row["caller"],
                "role": row["role"],
                "status": row["status"],
                "count": row["count"],
                "shared_with": row["shared_with"],
                "groups": [
                    {
                        "kind": g["kind"],
                        "items": g["items"],
                        "sessions": g["sessions"],
                        "utility": g["utility"],
                    }
                    for g in row["groups"]
                ],
                "sessions": sum(g["sessions"] for g in row["groups"]),
                "calls": {e: tokens[e]["calls"] for e in ESTIMATES},
                "prompt_tokens": {e: tokens[e]["input"] for e in ESTIMATES},
                "completion_tokens": {e: tokens[e]["output"] for e in ESTIMATES},
                "dollars": priced,
            }
        )
    return out


def count_runs(specs: Mapping[str, str]) -> dict[str, Any]:
    """Each named config counted by the runner (`run.ts --count`); no model is called."""
    out: dict[str, Any] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name, rel in sorted(specs.items()):
            target = Path(tmp) / name
            run_node(
                ["packages/runner/scripts/run.ts", "--config", rel, "--out", str(target), "--count"]
            )
            out[name] = json.loads((target / "count.json").read_text(encoding="utf-8"))
    return out


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    inputs = load_inputs(config["inputs"])
    data = REPO / str(config["gatemem_data"]["full"])
    ensure_pinned_gatemem(
        data,
        REPO / str(config["gatemem_data"]["manifest"]),
        fetch=bool(config["gatemem_data"]["fetch"]),
    )
    c1 = c1_gatemem_chars(data, int(config["long_context_turns"]))
    counts = count_runs(config["count_configs"])
    shapes = Shapes(config, inputs, c1, counts)
    rows = build_rows(config, inputs, shapes)
    sets = price_sets(config, inputs)
    flags = model_flags(config, inputs)
    primary = str(load_config(REPO / config["prices"][0])["name"])
    return {
        "name": config["name"],
        "inputs": {
            k: {"file": v, "sha256": sha256_file(REPO / v)} for k, v in config["inputs"].items()
        },
        "prices": {
            k: {kk: vv for kk, vv in v.items() if kk != "models"} | {"models": v["models"]}
            for k, v in sorted(sets.items())
        },
        "primary_prices": primary,
        "estimates": config["estimates"],
        "ceiling_factor": config["ceiling_factor"],
        "gatemem_c1_block_chars": c1,
        "l3_pilot_count": {
            k: {"calls": v["calls"], "per_seed": v["per_seed"]} for k, v in counts.items()
        },
        "design_shapes": config["design_shapes"],
        "options": config["options"],
        "rows": table(rows, config, sets, flags, primary),
        "totals": totals(rows, config, sets, flags),
        "assumptions": config["assumptions"],
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
