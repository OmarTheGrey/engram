"""Quote grounding of the model lints on card L3's fault fixtures (card L9, a proof of concept).

Usage:
    uv run python research/scripts/l9_grounding.py \\
        --config research/configs/l9-grounding.json \\
        --out research/results/h3-l9-grounding.json

The script replays two lint runner configs with packages/runner/scripts/run.ts
under ENGRAM_OFFLINE=1, each from its committed cassettes, and fails on any
new model call:

- `plain_config`: card L3's fixture run, the option absent (the registered
  prompts).
- `grounded_config`: the same four model fault fixtures and seeds with
  `lints.model.evidence: "on"`, answered by card L9's scripted model, which
  gives every input and seed card L3's verdict, in the grounded shape, with
  four planted quotes (one folded, one invented, one paraphrased, one short).

Per run, lint and seed, and pooled over the seeds, at the level of the unit
(a pair or a claim, labelled flag or pass by its fixture): the units the
model flagged, the findings, the flags the quote check downgraded to
`ungrounded`, and precision and recall of the findings against the labels.
It lists every downgraded flag with its label and the check's reason, and
checks that the two runs gave the same verdicts unit for unit, that every
grounded finding carries a quote line per quote field and no plain finding
carries one.

The model is scripted, so every number shows the pipeline working on
fixtures (the check keeps found quotes, drops the others, and leaves the
plain run as it was); it says nothing about how often a real model quotes,
and it is not a result for H3. Question 2 of docs/tasks/absorb-plan-2.md
(quote grounding as an H3 amendment) is the lead's.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.h3_lint_delta import replay
from scripts.lint_scores import read_jsonl
from scripts.results_io import load_config, write_result

LINTS = ("contradiction", "unsupported-claim")
QUOTES = {"contradiction": 2, "unsupported-claim": 1}

Row = Mapping[str, Any]


def replayed(runner_config: str, prefix: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """A config's rows and call counts, replayed offline; any new call fails."""
    with tempfile.TemporaryDirectory(prefix=prefix) as tmp:
        out = Path(tmp)
        replay(runner_config, None, out)
        rows = read_jsonl(out / "results.jsonl")
        usage = json.loads((out / "usage.json").read_text(encoding="utf-8"))
    calls = usage["calls"]
    if calls["new"] != 0:
        raise ValueError(f"{runner_config}: {calls['new']} new model calls on a replay")
    return rows, {"new": int(calls["new"]), "cached": int(calls["cached"])}


def _ratio(num: int, den: int) -> float | None:
    return None if den == 0 else num / den


def cell(units: Sequence[tuple[str, str]]) -> dict[str, Any]:
    """Counts, precision and recall over (label, outcome) pairs of labelled units."""
    flagged = sum(1 for _, o in units if o in ("flag", "ungrounded"))
    found = [lab for lab, o in units if o == "flag"]
    tp = sum(1 for lab in found if lab == "flag")
    labelled = sum(1 for lab, _ in units if lab == "flag")
    return {
        "units": len(units),
        "labelled_flag": labelled,
        "model_flags": flagged,
        "findings": len(found),
        "ungrounded": sum(1 for _, o in units if o == "ungrounded"),
        "true_findings": tp,
        "false_findings": len(found) - tp,
        "precision": _ratio(tp, len(found)),
        "recall": _ratio(tp, labelled),
    }


def labelled(rows: Sequence[Row], lint: str, seed: int | None) -> list[tuple[str, str]]:
    """(label, outcome) of every labelled unit of `lint`, at `seed` or every seed."""
    out: list[tuple[str, str]] = []
    for r in rows:
        if r["lint_id"] != lint or (seed is not None and r["seed"] != seed):
            continue
        labels = {u["unit"]: u["verdict"] for u in r["labels"]["units"]}
        for j in r["judgments"]:
            if j["unit"] in labels:
                out.append((labels[j["unit"]], j["outcome"]))
    return out


def table(rows: Sequence[Row], seeds: Sequence[int]) -> dict[str, Any]:
    return {
        lint: {
            "per_seed": {str(s): cell(labelled(rows, lint, s)) for s in seeds},
            "pooled": cell(labelled(rows, lint, None)),
        }
        for lint in LINTS
    }


def verdict(outcome: str) -> str:
    """What the model said, before the quote check: a downgraded flag was a flag."""
    return "flag" if outcome == "ungrounded" else outcome


def checks(plain: Sequence[Row], grounded: Sequence[Row]) -> dict[str, Any]:
    """The run's own checks; any failure stops the script."""
    key = lambda r: (r["fixture"], r["seed"])  # noqa: E731
    by = {key(r): r for r in plain}
    same = 0
    for g in grounded:
        p = by[key(g)]
        pv = [(j["unit"], j["outcome"]) for j in p["judgments"]]
        gv = [(j["unit"], verdict(j["outcome"])) for j in g["judgments"]]
        if pv != gv:
            raise ValueError(f"{key(g)}: the scripted verdicts differ between the runs")
        same += len(gv)
    for r in plain:
        for f in r["findings"]:
            if any(e.startswith("quote of ") for e in f["evidence"]):
                raise ValueError(f"{key(r)}: a plain finding carries a quote")
        for j in r["judgments"]:
            if "grounding" in j or j["outcome"] == "ungrounded":
                raise ValueError(f"{key(r)}: a plain judgment was grounded")
    quoted = 0
    for r in grounded:
        for f in r["findings"]:
            if f["lint_id"] not in QUOTES:
                continue
            n = sum(1 for e in f["evidence"] if e.startswith("quote of "))
            if n != QUOTES[f["lint_id"]]:
                raise ValueError(f"{key(r)}: a grounded finding carries {n} quotes")
            quoted += 1
    return {"same_verdicts": same, "grounded_findings_quoted": quoted}


def downgraded(rows: Sequence[Row]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        labels = {u["unit"]: u["verdict"] for u in r["labels"]["units"]}
        for j in r["judgments"]:
            if j["outcome"] != "ungrounded":
                continue
            failed = [g for g in j["grounding"] if not g["found"]]
            out.append(
                {
                    "fixture": r["fixture"],
                    "seed": r["seed"],
                    "unit": j["unit"],
                    "label": labels.get(j["unit"]),
                    "failed": [
                        {"field": g["field"], "quote": g["quote"], "reason": g["reason"]}
                        for g in failed
                    ],
                }
            )
    return sorted(out, key=lambda d: (d["fixture"], d["seed"], d["unit"]))


def build(config: Mapping[str, Any]) -> dict[str, Any]:
    plain, plain_calls = replayed(config["plain_config"], "l9-plain-")
    grounded, grounded_calls = replayed(config["grounded_config"], "l9-grounded-")
    seeds = sorted({int(r["seed"]) for r in plain})
    base, on = table(plain, seeds), table(grounded, seeds)
    return {
        "name": config["name"],
        "hypothesis": "none",
        "status": "proof of concept",
        "registered": False,
        "configs": {"plain": config["plain_config"], "grounded": config["grounded_config"]},
        "seeds": seeds,
        "calls": {"plain": plain_calls, "grounded": grounded_calls},
        "checks": checks(plain, grounded),
        "plain": base,
        "grounded": on,
        "downgraded": downgraded(grounded),
        "totals": {
            "plain_findings": sum(base[lint]["pooled"]["findings"] for lint in LINTS),
            "plain_false_findings": sum(base[lint]["pooled"]["false_findings"] for lint in LINTS),
            "grounded_findings": sum(on[lint]["pooled"]["findings"] for lint in LINTS),
            "grounded_false_findings": sum(on[lint]["pooled"]["false_findings"] for lint in LINTS),
            "ungrounded": sum(on[lint]["pooled"]["ungrounded"] for lint in LINTS),
            "ungrounded_true_flags": sum(1 for d in downgraded(grounded) if d["label"] == "flag"),
        },
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, build(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
