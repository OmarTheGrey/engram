"""The local NLI tier beside the model tier on the fixture (card L7, arm P3, not registered).

Usage:
    uv run python research/scripts/h3_lint_nli.py \\
        --config research/configs/h3-lint-nli.json \\
        --out research/results/h3-lint-nli.json

Arm P3 of the pre-registration's "Proposed amendments, not yet registered"
is not registered, so every number here is an engineering check of the
pipeline and of the pinned scorer on the fixture, never a thesis result.

The script replays three runner configs with packages/runner/scripts/run.ts
under ENGRAM_OFFLINE=1, each from its committed cassettes, and fails on any
new model call or any new NLI score:

- `threshold_config`: card L3's two contradiction fixtures with the tier on.
  The thresholds are derived again from its labelled units by the config's
  `threshold_rule` and must equal the ones both tier configs froze: the upper
  is the first grid step strictly above every pass-labelled pair's score, at
  least `upper_at_least`; a pass scored 1 leaves no upper of at most 1
  strictly above it, and the rule then refuses (review L7-8). The lower is
  the last grid step at or below every flag-labelled pair's score, at most
  `lower_at_most`. Both bounds are hand choices.
- `model_tier_config`: card L4's fixture run, the model tier alone.
- `runner_config`: the same states, seeds, scripted model and cassettes with
  the tier on, so the band's model calls are the model tier's own requests.

It reports the model calls the tier saves per seed (the contradiction lint's
units the model tier sent, less the band's), every contradiction label's band
and score, and recall and labelled precision per class and subtype, keyed and
unkeyed apart, for the model tier, the tiered lint (the tier's flags and the
band's model findings), and the tier alone (its flags only). It also counts
the pairs at or above 0.5, 0.9, 0.99 and 0.999, by the larger of both
directions and forward only, and what a forward-only upper of 0.9 would flag,
with every flagged item no label names (review L7-2). The model of the
fixture runs is scripted (card L4's planted answers), so the model tier's and
the tiered lint's figures check the pipeline; the band counts, the scores and
the tier alone's figures come from the pinned NLI model's real scores.
"""

from __future__ import annotations

import argparse
import json
import math
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.h3_lint_delta import replay
from scripts.lint_scores import (
    CLASSES,
    KEYS,
    Flags,
    by_question,
    flags_of,
    label_unit,
    read_jsonl,
    tier_scores,
)
from scripts.results_io import REPO, load_config, write_result

CONTRADICTION = "contradiction"
NLI = "contradiction-nli"
BANDS = ("flag", "model", "drop")
CUTS = (0.5, 0.9, 0.99, 0.999)
FORWARD_CUT = 0.9

Row = Mapping[str, Any]


def replayed(runner_config: str, prefix: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """A config's rows and usage, replayed offline; any new call or score fails."""
    with tempfile.TemporaryDirectory(prefix=prefix) as tmp:
        out = Path(tmp)
        replay(runner_config, None, out)
        rows = read_jsonl(out / "results.jsonl")
        usage = json.loads((out / "usage.json").read_text(encoding="utf-8"))
    if usage["calls"]["new"] != 0:
        raise RuntimeError(f"{runner_config}: {usage['calls']['new']} new model calls on a replay")
    if usage.get("scores", {}).get("new", 0) != 0:
        raise RuntimeError(f"{runner_config}: {usage['scores']['new']} new NLI scores on a replay")
    return rows, usage


def derive_thresholds(rows: Sequence[Row], rule: Mapping[str, Any]) -> dict[str, Any]:
    """The thresholds the rule gives on card L3's labelled contradiction units, and the units."""
    grid = float(rule["grid"])
    steps = round(1 / grid)
    units: list[dict[str, Any]] = []
    seen: set[str] = set()
    for r in sorted(rows, key=lambda r: (str(r["fixture"]), int(r["seed"]))):
        verdicts = {str(u["unit"]): str(u["verdict"]) for u in r["labels"]["units"]}
        for j in r["nli"]:
            key = f"{r['fixture']}/{j['unit']}"
            if key in seen or j["unit"] not in verdicts:
                continue
            seen.add(key)
            units.append(
                {
                    "fixture": r["fixture"],
                    "unit": j["unit"],
                    "verdict": verdicts[j["unit"]],
                    "forward": j["forward"]["contradiction"],
                    "backward": j["backward"]["contradiction"],
                    "contradiction": j["contradiction"],
                }
            )
    passes = [u["contradiction"] for u in units if u["verdict"] == "pass"]
    flags = [u["contradiction"] for u in units if u["verdict"] == "flag"]
    above = (math.floor(max(passes) * steps) + 1) / steps
    if above > 1:
        # Review L7-8: no upper of at most 1 lies strictly above a pass scored 1;
        # the rule refuses rather than flag that pass.
        raise ValueError(
            f"a pass-labelled pair scored {max(passes)}: no upper of at most 1 lies strictly"
            " above it, so the rule gives no flag band; choose the thresholds by hand"
        )
    upper = max(float(rule["upper_at_least"]), above)
    lower = min(float(rule["lower_at_most"]), math.floor(min(flags) * steps) / steps)
    return {"upper": upper, "lower": lower, "units": units}


def renamed(findings: Sequence[Row], keep_model: bool) -> list[dict[str, Any]]:
    """Model-tier findings with the tier's flags scored as the contradiction lint's.

    keep_model false keeps the tier's flags only: the tier alone.
    """
    out: list[dict[str, Any]] = []
    for f in findings:
        if f["tier"] != "model":
            continue
        if f["lint_id"] == NLI:
            out.append({**f, "lint_id": CONTRADICTION})
        elif keep_model:
            out.append(dict(f))
    return out


def classes(
    labels: Mapping[str, Sequence[Row]], rows: Sequence[Row], keep_model: bool
) -> dict[str, Any]:
    """Recall and labelled precision of the model tier's findings, per class and subtype."""
    flags: dict[str, Flags] = {}
    base: dict[str, set[str]] = {}
    for r in rows:
        q = str(r["question_id"])
        flags[q], base[q] = flags_of(renamed(r["findings"], keep_model))
    scored = tier_scores(labels, flags, base, ["model"])
    return {
        "by_class": {c: {k: scored["by_class"][c][k] for k in KEYS} for c in CLASSES},
        "by_subtype": scored["by_subtype"],
        "overall": scored["overall"],
        "unverified": scored["unverified"],
    }


def contradiction_units(rows: Sequence[Row]) -> int:
    return sum(1 for r in rows for j in r["judgments"] if j["lint_id"] == CONTRADICTION)


def other_units(rows: Sequence[Row]) -> list[str]:
    return sorted(
        f"{r['question_id']}/{j['unit']}"
        for r in rows
        for j in r["judgments"]
        if j["lint_id"] != CONTRADICTION
    )


def bands_of(rows: Sequence[Row]) -> dict[str, dict[str, Any]]:
    """Each question's scored pairs by unit; the same at every seed, as the scorer draws nothing."""
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        q = str(r["question_id"])
        mine = {str(j["unit"]): j for j in r["nli"]}
        if q in out and {u: j["band"] for u, j in out[q].items()} != {
            u: j["band"] for u, j in mine.items()
        }:
            raise ValueError(f"{q}: the tier's bands differ between seeds")
        out[q] = mine
    return out


def label_bands(
    labels: Mapping[str, Sequence[Row]], bands: Mapping[str, Mapping[str, Any]]
) -> dict[str, Any]:
    """Each label about the contradiction lint: its unit's band and score; counts by subtype."""
    units: list[dict[str, Any]] = []
    counts: dict[str, Any] = {}
    for q in sorted(labels):
        for la in labels[q]:
            if CONTRADICTION not in [*la["expected"]["model"], *la["near_miss_of"]["model"]]:
                continue
            unit = label_unit(la, CONTRADICTION)
            judged = bands.get(q, {}).get(unit)
            band = "not_scored" if judged is None else str(judged["band"])
            units.append(
                {
                    "question_id": q,
                    "item_id": la["item_id"],
                    "subtype": la["subtype"],
                    "kind": la["kind"],
                    "band": band,
                    "contradiction": None if judged is None else judged["contradiction"],
                }
            )
            cell = counts.setdefault(str(la["subtype"]), {}).setdefault(
                str(la["kind"]), {b: 0 for b in (*BANDS, "not_scored")}
            )
            cell[band] += 1
    return {"by_subtype": counts, "labels": units}


def unique_pairs(rows: Sequence[Row]) -> list[tuple[str, Mapping[str, Any]]]:
    """Each question's scored pairs once, whatever the seeds: the scorer draws nothing."""
    seen: dict[tuple[str, str], Mapping[str, Any]] = {}
    for r in rows:
        for j in r["nli"]:
            seen.setdefault((str(r["question_id"]), str(j["unit"])), j)
    return [(q, j) for (q, _), j in sorted(seen.items())]


def score_counts(rows: Sequence[Row]) -> dict[str, Any]:
    """Pairs at or above each cut: the larger of both directions, and forward only (review L7-2)."""
    pairs = unique_pairs(rows)

    def at(cut: float, value: str) -> int:
        return sum(
            1
            for _, j in pairs
            if (j["contradiction"] if value == "both" else j["forward"]["contradiction"]) >= cut
        )

    return {
        "pairs": len(pairs),
        "both_directions": {str(c): at(c, "both") for c in CUTS},
        "forward_only": {str(c): at(c, "forward") for c in CUTS},
    }


def forward_flags(
    rows: Sequence[Row], labels: Mapping[str, Sequence[Row]], cut: float
) -> dict[str, Any]:
    """What a forward-only upper at `cut` would flag: pairs, items, and the items no label names."""
    flagged: dict[tuple[str, str], int] = {}
    for q, j in unique_pairs(rows):
        if j["forward"]["contradiction"] >= cut:
            key = (q, str(j["item_id"]))
            flagged[key] = flagged.get(key, 0) + 1
    kinds: dict[tuple[str, str], str] = {}
    rank = {"contradiction_fault": 0, "contradiction_near_miss": 1, "other_label": 2}
    for q, ls in labels.items():
        for la in ls:
            about = CONTRADICTION in [*la["expected"]["model"], *la["near_miss_of"]["model"]]
            if not about:
                kind = "other_label"
            elif la["kind"] == "fault":
                kind = "contradiction_fault"
            else:
                kind = "contradiction_near_miss"
            key = (q, str(la["finding_on"]))
            if key not in kinds or rank[kind] < rank[kinds[key]]:
                kinds[key] = kind
    return {
        "cut": cut,
        "pairs": sum(flagged.values()),
        "items": len(flagged),
        **{f"{k}_items": sum(1 for x in flagged if kinds.get(x) == k) for k in rank},
        "unlabelled": [
            {"question_id": q, "item_id": i, "pairs": n}
            for (q, i), n in sorted(flagged.items())
            if (q, i) not in kinds
        ],
    }


def build(config: Mapping[str, Any]) -> dict[str, Any]:
    rule = config["threshold_rule"]
    threshold_path = str(config["threshold_config"])
    tier_path = str(config["runner_config"])
    model_path = str(config["model_tier_config"])
    tier_cfg = load_config(REPO / tier_path)
    model_cfg = load_config(REPO / model_path)
    threshold_cfg = load_config(REPO / threshold_path)
    for key in ("benchmark", "data", "questions", "model", "seeds", "script", "cassettes"):
        if tier_cfg[key] != model_cfg[key]:
            raise ValueError(f"{tier_path} and {model_path} differ in {key}")
    l3_rows, l3_usage = replayed(threshold_path, "engram-l7-l3-")
    derived = derive_thresholds(l3_rows, rule)
    for path, cfg in ((threshold_path, threshold_cfg), (tier_path, tier_cfg)):
        frozen = cfg["nli"]["thresholds"]
        if (float(frozen["upper"]), float(frozen["lower"])) != (derived["upper"], derived["lower"]):
            raise ValueError(
                f"{path} freezes {frozen}, but the rule gives upper {derived['upper']} and lower"
                f" {derived['lower']} on {threshold_path}"
            )
    model_rows, model_usage = replayed(model_path, "engram-l7-model-")
    tier_rows, tier_usage = replayed(tier_path, "engram-l7-tier-")
    data = ((REPO / tier_path).parent / str(tier_cfg["data"])).resolve()
    questions = sorted({str(r["question_id"]) for r in tier_rows})
    labels = {
        q: ls for q, ls in by_question(read_jsonl(data / "labels.jsonl")).items() if q in questions
    }
    seeds = [int(s) for s in tier_cfg["seeds"]]
    per_seed: dict[str, Any] = {}
    for s in seeds:
        m = [r for r in model_rows if int(r["seed"]) == s]
        t = [r for r in tier_rows if int(r["seed"]) == s]
        if other_units(m) != other_units(t):
            raise ValueError(f"seed {s}: the tier changed the unsupported-claim lint's units")
        sent, band = contradiction_units(m), contradiction_units(t)
        scored = sum(len(r["nli"]) for r in t)
        if scored != sent:
            raise ValueError(
                f"seed {s}: the tier scored {scored} pairs, the model tier sent {sent}"
            )
        per_seed[str(s)] = {
            "calls": {
                "model_tier_contradiction": sent,
                "tiered_contradiction": band,
                "saved": sent - band,
                "saved_share": (sent - band) / sent if sent else None,
                "unsupported_claim_both": len(other_units(m)),
            },
            "bands": {b: sum(1 for r in t for j in r["nli"] if j["band"] == b) for b in BANDS},
            "model_tier": classes(labels, m, True),
            "tiered": classes(labels, t, True),
            "nli_alone": classes(labels, t, False),
        }
    return {
        "name": config["name"],
        "hypothesis": config["hypothesis"],
        "arm": config["arm"],
        "registered": False,
        "decides": False,
        "status": "engineering check: arm P3 is proposed in docs/research/preregistration.md, not"
        " registered; no number here is a thesis result",
        "nli_model": tier_cfg["nli"]["model"],
        "thresholds": {
            "upper": derived["upper"],
            "lower": derived["lower"],
            "rule": dict(rule),
            "set_on": threshold_path,
            "labelled_units": derived["units"],
        },
        "runner_config": tier_path,
        "model_tier_config": model_path,
        "model": tier_cfg["model"],
        "scripted_model": str(tier_cfg["model"]).startswith("scripted/"),
        "seeds": seeds,
        "questions": len(questions),
        "replays": {
            "threshold": {"calls": l3_usage["calls"], "scores": l3_usage["scores"]},
            "model_tier": {"calls": model_usage["calls"]},
            "tiered": {"calls": tier_usage["calls"], "scores": tier_usage["scores"]},
        },
        "label_bands": label_bands(labels, bands_of(tier_rows)),
        "score_counts": score_counts(tier_rows),
        "forward_only_flags": forward_flags(tier_rows, labels, FORWARD_CUT),
        "per_seed": per_seed,
        "matching": "as card L4's scorer: a label is flagged when the contradiction lint lands on"
        " its finding_on; the tier's own flags (lint contradiction-nli) are scored as the"
        " contradiction lint's; tiered is the tier's flags with the band's model findings;"
        " nli_alone is the tier's flags only",
        "limits": "the model tier and the tiered lint run on card L4's scripted model, whose"
        " planted answers make their recall and precision pipeline checks; the band counts,"
        " the calls saved, every label's band and the tier alone's figures come from the"
        " pinned NLI model's scores; two LongMemEval questions, English only",
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
