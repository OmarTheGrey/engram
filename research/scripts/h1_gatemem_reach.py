"""H1 evidence: how much of what GateMem scores as a leak the asker can read under ADR 0030.

Usage:
    uv run python research/scripts/h1_gatemem_reach.py \\
        --config research/configs/h1-gatemem-reach.json \\
        --out research/results/h1-gatemem-reach.json

For every access-control and active-forgetting checkpoint of GateMem's pinned
full set (docs/tasks/prereg-v1-plan.md, PR 2, item 2): the checkpoint's turns
up to its as-of turn go through the plane as their speakers' writes (ADR
0030's mapping, the C5 probe's ingestion), the asker reads with no query, and
each pattern is looked for in the turns that read returns. The plane, the
mapping and the scorer's matcher are TypeScript, reached through
packages/runner/scripts/gatemem-reach.ts, never reimplemented here; this
script checks the data against the pinned hashes (fetching it into
.engram/upstream when the config allows) and aggregates the rows.

Two pattern sets are reported. `scored` is what GateMem's scorer and judge
count as a leak: an access checkpoint's not_include patterns and leak
targets, a forgetting checkpoint's leak targets. `targets` is the leak
targets alone. For each, every checkpoint falls in exactly one of three
groups, whose shares sum to one:

- `reachable`: at least one pattern matches a turn the asker reads, so C5
  hands it to the model and only the model can withhold it;
- `located_unreachable`: some pattern matches a turn of the history, and none
  matches a turn the asker reads, so the plane keeps every match away;
- `not_located`: no pattern matches any turn up to the as-of turn.

`every_pattern_reachable` counts checkpoints whose every pattern is in reach.
Patterns match by text, and a generic one ("Wednesday", "no") can match a
turn that holds nothing secret, so the share with every pattern in reach and
the share with any pattern in reach bracket the share whose secret is in
reach; the audit sample lets a person check matches by hand.

`refusal_leak` counts checkpoints where at least one of the config's plain
refusals is itself scored as a leak by the rule-based scorer (a pattern such
as "no" inside "No, I can't share that"): no condition can prevent it.

Patterns match by text, so a match can be a coincidence. `with_bare_pattern`
and `only_bare_patterns` count checkpoints with at least one, or only, bare
patterns (the config's `bare`: a word such as "yes" or "no", or three
characters or fewer), and `with_yes_no` those with a pattern that is exactly
"yes" or "no". Neither share brackets the share whose secret is in reach: a
checkpoint whose every pattern is bare can be counted reachable on a
coincidence. The audit sample draws whole checkpoints, each with all its
patterns and matches, so a person can estimate that share by hand.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

import numpy as np

from scripts.results_io import REPO, ensure_pinned_gatemem, load_config, write_result

ENTRY = "packages/runner/scripts/gatemem-reach.ts"
SETS = {"targets": "", "scored": "scored_"}


def _share(count: int, total: int) -> float:
    return count / total if total else 0.0


def is_bare(pattern: str, bare: Mapping[str, Any]) -> bool:
    """A pattern that can match by coincidence: a listed word, or no longer than `max_length`."""
    text = pattern.strip().lower()
    return text in {str(w) for w in bare["words"]} or len(text) <= int(bare["max_length"])


def _patterns(row: Mapping[str, Any], prefix: str) -> list[str]:
    return [p["pattern"] for p in row["patterns"] if prefix != "" or p["set"] == "target"]


def pattern_stats(
    rows: Sequence[Mapping[str, Any]], prefix: str, bare: Mapping[str, Any]
) -> dict[str, Any]:
    """The three groups, the every-pattern count and the bare-pattern counts for one set."""
    n = len(rows)
    sets = [_patterns(r, prefix) for r in rows]
    with_bare = sum(1 for ps in sets if any(is_bare(p, bare) for p in ps))
    only_bare = sum(1 for ps in sets if ps and all(is_bare(p, bare) for p in ps))
    yes_no = sum(1 for ps in sets if any(p.strip().lower() in ("yes", "no") for p in ps))
    total = "targets" if prefix == "" else "scored_patterns"
    reachable = sum(1 for r in rows if r[f"{prefix}reachable"] > 0)
    located = sum(1 for r in rows if r[f"{prefix}located"] > 0)
    unreachable = located - reachable
    every = sum(1 for r in rows if r[total] > 0 and r[f"{prefix}reachable"] == r[total])
    return {
        "patterns": sum(r[total] for r in rows),
        "patterns_located": sum(r[f"{prefix}located"] for r in rows),
        "patterns_reachable": sum(r[f"{prefix}reachable"] for r in rows),
        "reachable": reachable,
        "located_unreachable": unreachable,
        "not_located": n - located,
        "every_pattern_reachable": every,
        "reachable_own": sum(1 for r in rows if r[f"{prefix}reachable_own"] > 0),
        "reachable_granted": sum(1 for r in rows if r[f"{prefix}reachable_granted"] > 0),
        "share_reachable": _share(reachable, n),
        "share_located_unreachable": _share(unreachable, n),
        "share_not_located": _share(n - located, n),
        "share_every_pattern_reachable": _share(every, n),
        "with_bare_pattern": with_bare,
        "only_bare_patterns": only_bare,
        "with_yes_no": yes_no,
    }


def stats(rows: Sequence[Mapping[str, Any]], bare: Mapping[str, Any]) -> dict[str, Any]:
    """Counts and shares over a group of checkpoint rows, for both pattern sets."""
    n = len(rows)
    refusal = sum(1 for r in rows if r["refusal_leaks"] > 0)
    return {
        "checkpoints": n,
        "denied_writes": sum(r["denied_writes"] for r in rows),
        "context_leak": sum(1 for r in rows if r["context_leak"]),
        "with_extra_patterns": sum(1 for r in rows if r["extra_patterns"] > 0),
        "refusal_leak": refusal,
        "share_refusal_leak": _share(refusal, n),
        **{name: pattern_stats(rows, prefix, bare) for name, prefix in SETS.items()},
    }


def _grouped(rows: Iterable[Mapping[str, Any]], key: str) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = {}
    for r in rows:
        out.setdefault("none" if r[key] is None else str(r[key]), []).append(r)
    return dict(sorted(out.items()))


def summarise(rows: Sequence[Mapping[str, Any]], bare: Mapping[str, Any]) -> dict[str, Any]:
    """Per checkpoint kind: overall, per domain, and per attack type (exploratory)."""
    kinds: dict[str, Any] = {}
    for kind, mine in _grouped(rows, "kind").items():
        kinds[kind] = {
            "all": stats(mine, bare),
            "domains": {d: stats(g, bare) for d, g in _grouped(mine, "domain").items()},
            "attack_types": {a: stats(g, bare) for a, g in _grouped(mine, "attack_type").items()},
        }
    return {"kinds": kinds, "all": stats(rows, bare)}


def audit_sample(
    rows: Sequence[Mapping[str, Any]], per_kind: int, seed: int
) -> list[dict[str, Any]]:
    """A seeded sample of reachable checkpoints, `per_kind` per kind, each with all its matches.

    Drawn among the checkpoints with a scored pattern in reach, so a hand
    audit of the sample estimates the share of them whose match is the secret.
    """
    rng = np.random.default_rng(seed)
    sample: list[dict[str, Any]] = []
    for kind, mine in _grouped(rows, "kind").items():
        reachable = [r for r in mine if r["hits"]]
        chosen = rng.choice(len(reachable), size=min(per_kind, len(reachable)), replace=False)
        for i in sorted(int(c) for c in chosen):
            r = reachable[i]
            sample.append(
                {
                    "checkpoint_id": r["checkpoint_id"],
                    "kind": kind,
                    "domain": r["domain"],
                    "attack_type": r["attack_type"],
                    "patterns": r["patterns"],
                    "hits": r["hits"],
                }
            )
    return sorted(sample, key=lambda c: (c["kind"], c["checkpoint_id"]))


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    data = REPO / str(config["data"])
    commit = ensure_pinned_gatemem(
        data, REPO / str(config["manifest"]), fetch=bool(config["fetch"])
    )
    presets = sorted(str(p) for p in config["presets"])
    refusals = [str(r) for r in config["refusals"]]
    rows: dict[str, list[dict[str, Any]]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        refusal_file = Path(tmp) / "refusals.json"
        refusal_file.write_text(json.dumps(refusals), encoding="utf-8")
        # One node process per preset, run side by side; each is independent.
        procs = {
            p: subprocess.Popen(
                [
                    "node",
                    ENTRY,
                    "--data",
                    str(data),
                    "--preset",
                    p,
                    "--refusals",
                    str(refusal_file),
                    "--out",
                    str(Path(tmp) / p),
                ],
                cwd=REPO,
            )
            for p in presets
        }
        for p, proc in procs.items():
            if proc.wait() != 0:
                raise RuntimeError(f"{ENTRY} failed under preset {p}")
        for p in presets:
            out = json.loads((Path(tmp) / p).read_text(encoding="utf-8"))
            if out["preset"] != p:
                raise RuntimeError(f"{ENTRY} wrote preset {out['preset']}, asked for {p}")
            rows[p] = out["rows"]
    primary = str(config["primary_preset"])
    audit = config["audit"]
    return {
        "name": config["name"],
        "benchmark": "gatemem",
        "commit": commit,
        "mapping": "ADR 0030 (packages/bench/src/gatemem/plane.ts)",
        "presets": presets,
        "primary_preset": primary,
        "identical_across_presets": all(rows[p] == rows[primary] for p in presets),
        "refusals": refusals,
        "bare": config["bare"],
        "by_preset": {p: summarise(rows[p], config["bare"]) for p in presets},
        "audit_sample": audit_sample(rows[primary], int(audit["per_kind"]), int(audit["seed"])),
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
