"""H3's deterministic floor (card L4): card L1's lints on card L2's full seeded-fault set.

Usage:
    uv run python research/scripts/h3_lint_floor.py \\
        --config research/configs/h3-lint-floor.json \\
        --out research/results/h3-lint-floor.json

The set is the one research/results/h3-fault-set.json names: its directory
(under .engram/, built by research/scripts/h3_fault_set.py) is checked against
the sha256 that result commits for policy.json, states.jsonl and labels.jsonl,
and rebuilt from the pinned S split by that script's own functions when a file
is missing or differs (data only, never a model). Every state is then linted
by packages/runner/scripts/lint-fault-set.ts, split across worker processes:
Plane.lint without a lint model under the set's lint-time policy, so only the
deterministic lints run, beside the units card L3's model lints would send
(planModelLints). The lints and the planning are TypeScript and are not
reimplemented here; scripts/lint_scores.py joins their findings with the
labels.

The result holds, for the deterministic tier:

- precision and recall per class (keyed, unkeyed and pooled) and per subtype
  and variant, with 95 percent Wilson intervals, on the labelled items;
- the same precision with every finding on an item no label is about (one of
  LongMemEval's own items, or an unlabelled injected one) counted as
  unverified: the count and the bound it gives;
- per lint: its own faults and near-misses, and where else it flagged;
- `by_construction`: which of these numbers the set fixes by how it is built,
  and the set's `limits` as card L2's result states them;
- `model_run`: what the model-based tier's live run (the runner config the
  config names) would call: units per lint per seed, prompt characters, and
  how many units are about a labelled item. No model is called.

The run checks itself against card L2's label check and fails when the keyed
faults flagged, the near-misses flagged or the base-item findings differ.
"""

from __future__ import annotations

import argparse
import tempfile
from collections import Counter
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from scripts import h3_fault_set
from scripts.lint_scores import (
    by_question,
    flags_of,
    label_unit,
    lint_scores,
    lints_of,
    read_jsonl,
    tier_scores,
)
from scripts.results_io import REPO, load_config, run_node, sha256_file, workers, write_result

ENTRY = "packages/runner/scripts/lint-fault-set.ts"
CHECKED = ("policy.json", "states.jsonl", "labels.jsonl")
MAX_PARTS = 16


def set_is_current(target: Path, expected: Mapping[str, str]) -> bool:
    """Whether every checked set file exists with the sha256 card L2's result commits."""
    return all(
        (target / name).exists() and sha256_file(target / name) == expected[name]
        for name in CHECKED
    )


def ensure_set(fault_config: Mapping[str, Any], fault_result: Mapping[str, Any]) -> Path:
    """The set directory, rebuilt by card L2's script when a file is missing or differs."""
    target = REPO / str(fault_config["set"])
    expected = fault_result["set"]["sha256"]
    if not set_is_current(target, expected):
        data = h3_fault_set.ensure_pinned_file(
            dict(fault_config["data"]), fetch=bool(fault_config.get("fetch", False))
        )
        h3_fault_set.build_set(data, fault_config, target)
        if not set_is_current(target, expected):
            raise ValueError(f"{target}: the rebuilt set differs from card L2's committed hashes")
    return target


def lint_set(target: Path, states: int) -> list[dict[str, Any]]:
    """Every state's deterministic findings and planned model units, in set order."""
    ranges = h3_fault_set.split(states, workers(min(states, MAX_PARTS)))
    with tempfile.TemporaryDirectory(prefix="engram-l4-") as tmp:
        root = Path(tmp)

        def run(part: int) -> Path:
            lo, hi = ranges[part]
            out = root / f"part-{part}.jsonl"
            run_node(
                [ENTRY, "--set", str(target), "--out", str(out), "--from", str(lo), "--to", str(hi)]
            )
            return out

        with ThreadPoolExecutor(len(ranges)) as pool:
            outs = list(pool.map(run, range(len(ranges))))
        rows = [row for out in outs for row in read_jsonl(out)]
    if len(rows) != states:
        raise ValueError(f"linted {len(rows)} states, expected {states}")
    return rows


def model_run(
    rows: Sequence[Mapping[str, Any]],
    labels: Mapping[str, Sequence[Mapping[str, Any]]],
    runner: Mapping[str, Any],
    runner_path: str,
) -> dict[str, Any]:
    """What the model-based tier's run would call, from the planned units; no model called."""
    per_lint: Counter[str] = Counter()
    chars = 0
    labelled_units: Counter[str] = Counter()
    labelled_planned: Counter[str] = Counter()
    labelled: Counter[str] = Counter()
    for row in rows:
        units = {str(u["unit"]) for u in row["planned"]}
        for u in row["planned"]:
            per_lint[str(u["lint_id"])] += 1
            chars += int(u["chars"])
        aimed: dict[str, set[str]] = {}
        for la in labels.get(str(row["question_id"]), []):
            for lint in [*la["expected"]["model"], *la["near_miss_of"]["model"]]:
                unit = label_unit(la, str(lint))
                labelled[str(lint)] += 1
                labelled_planned[str(lint)] += unit in units
                aimed.setdefault(str(lint), set()).add(unit)
        for lint, mine in aimed.items():
            labelled_units[lint] += len(mine & units)
    seeds = [int(s) for s in runner["seeds"]]
    per_seed = sum(per_lint.values())
    return {
        "runner_config": runner_path,
        "model": str(runner["model"]),
        "seeds": seeds,
        "per_lint_per_seed": dict(sorted(per_lint.items())),
        "per_seed": per_seed,
        "calls": per_seed * len(seeds),
        "prompt_characters_per_seed": chars,
        "labelled_units": {
            lint: {
                "labels": labelled[lint],
                "planned": labelled_planned[lint],
                "units": labelled_units[lint],
                "other_units_per_seed": per_lint[lint] - labelled_units[lint],
            }
            for lint in sorted(labelled)
        },
    }


def check_against_l2(scores: Mapping[str, Any], check: Mapping[str, Any]) -> None:
    """Fail unless this run agrees with card L2's label check on the same set."""
    keyed = scores["overall"]["keyed"]
    if keyed["tp"] != check["keyed_faults_flagged"] or keyed["faults"] != check["keyed_faults"]:
        raise ValueError("keyed faults flagged differ from card L2's label check")
    if scores["overall"]["all"]["fp"] != check["near_misses_flagged"]:
        raise ValueError("near-misses flagged differ from card L2's label check")
    base = sum(int(n) for n in check["unlabelled_findings_on_base_items"].values())
    if scores["unverified"]["base"] != base:
        raise ValueError("findings on base items differ from card L2's label check")


def by_construction(scores: Mapping[str, Any]) -> dict[str, Any]:
    """Which numbers the set fixes by how it is built, and which it measures."""
    keyed = scores["overall"]["keyed"]
    unkeyed = scores["overall"]["unkeyed"]
    return {
        "holds_by_construction": [
            "Deterministic recall and precision on the keyed labelled items "
            f"({keyed['tp']} of {keyed['faults']} faults, {keyed['fp']} of {keyed['near_misses']} "
            "near-misses flagged): each keyed subtype restates its lint's trigger, and card L2's "
            "label check fails the set unless every keyed fault is flagged and no near-miss is. "
            "They are a regression check on card L1's lints, not evidence for H3's statement "
            "that deterministic lints find seeded faults with useful precision.",
            "Deterministic recall on the unkeyed items "
            f"({unkeyed['tp']} of {unkeyed['faults']} faults): no deterministic lint is built "
            "for what makes an unkeyed item faulty, which is in its text only.",
            "Recall on wrong-scope: no lint of either tier is built for it.",
        ],
        "measured": [
            "The findings on LongMemEval's own items (`unverified.base`) and what they do to "
            "precision (`precision_with_unverified`): how many there are is measured; whether "
            "each is real is not known until members judge card L2's audit sample.",
        ],
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    fault_config = load_config(REPO / str(config["fault_set"]["config"]))
    fault_result = load_config(REPO / str(config["fault_set"]["result"]))
    runner_path = str(config["model_run"])
    runner = load_config(REPO / runner_path)
    target = ensure_set(fault_config, fault_result)
    rows = lint_set(target, int(fault_result["questions"]))
    labels = by_question(read_jsonl(target / "labels.jsonl"))
    flags: dict[str, Any] = {}
    base: dict[str, set[str]] = {}
    for row in rows:
        q = str(row["question_id"])
        flags[q], base[q] = flags_of(row["findings"])
    tier = ["deterministic"]
    scores = tier_scores(labels, flags, base, tier)
    check_against_l2(scores, fault_result["label_check"])
    all_labels = [la for ls in labels.values() for la in ls]
    det_lints = lints_of(all_labels, flags.values(), "deterministic")
    return {
        "name": config["name"],
        "hypothesis": "H3",
        "tier": "deterministic",
        "fault_set": {
            "result": str(config["fault_set"]["result"]),
            "directory": str(fault_config["set"]),
            "sha256": {name: fault_result["set"]["sha256"][name] for name in CHECKED},
            "states": len(rows),
            "labels": len(all_labels),
        },
        "policy": "the set's lint-time policy (policy.json): preset medium without its "
        "person-scope ttl, every lint enabled; no lint model, so only card L1's lints run",
        "matching": "a tier flags a label when one of its findings lands on the label's "
        "finding_on; an item flagged that is no label's finding_on is unverified",
        **scores,
        "by_lint": lint_scores(labels, flags, base, "deterministic", det_lints),
        "by_construction": by_construction(scores),
        "limits": fault_result["limits"],
        "audit": {
            "directory": fault_result["audit"]["directory"],
            "sampled": fault_result["audit"]["sampled"],
            "status": "unjudged: no member has filled the sheet, so precision on natural "
            "memory is a bound, not a number",
        },
        "model_run": model_run(rows, labels, runner, runner_path),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
