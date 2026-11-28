"""The erasure-residue check (card X19, proposal U7): residue rates per tier, backend and store.

Usage:
    uv run python research/scripts/h3_erasure_residue.py \\
        --config research/configs/h3-erasure-residue.json \\
        --out research/results/h3-erasure-residue.json

An engineering check, not a hypothesis result. Proposal U7 is in the
pre-registration's "Proposed amendments, not yet registered"; the lead decided
to register it as a descriptive arm by amendment once this check merges
(docs/log/2026-11-25-ans-2026-11-25-decision-u6-u7.md), so this result decides
nothing and adds nothing to Holm. It serves no hypothesis ("hypothesis":
"none"); the h3- prefix is the nearest, as the results register requires one.

The check itself is TypeScript (packages/bench/src/residue/, over core's
findResidue and scanBytes in packages/core/src/residue.ts), reached through
packages/bench/scripts/erasure-residue.ts once per log backend (SQLite,
embedded Postgres) and store (files, Mem0, Letta, the MCP memory file), one
after another, never reimplemented here: 20 person scopes, 10 exposed and 10
never-exposed canaries each, every person offboarded, every canary and its
fact's content hashes searched for in every tier. This script reduces each
run to the share of exposed canaries found outside what is retained by
decision, per tier, with Wilson intervals; the count retained by decision per
tier and kind; and the never-exposed canaries' found rate, the floor. The
scripted summaries replay from committed cassettes; no model is called and
nothing is fetched.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.wilson import wilson
from scripts.results_io import load_config, run_node, write_result

ENTRY = "packages/bench/scripts/erasure-residue.ts"
CHECK = "packages/bench/src/residue/check.ts"
SCAN = "packages/core/src/residue.ts"
LIVE_TIERS = ("projection", "explanations", "events", "log-other", "store-records")
BYTE_TIERS = ("db-file", "db-wal", "store-files", "store-history")
TIERS = LIVE_TIERS + BYTE_TIERS
RETAINED = (
    "promoted",
    "outside-person-scope",
    "shared-store-ref",
    "erased-content-hash",
    "surviving-hash",
)
ORDER = ("residue", *RETAINED)


def rate(successes: int, n: int, confidence: float) -> dict[str, Any]:
    """A share with its Wilson interval; null bounds when n is zero."""
    if n == 0:
        return {"successes": 0, "n": 0, "rate": None, "low": None, "high": None}
    low, high = wilson(successes, n, confidence)
    return {"successes": successes, "n": n, "rate": successes / n, "low": low, "high": high}


def outcome(row: Mapping[str, Any], tier: str) -> str | None:
    """What a canary was found as in `tier`, text or hash: residue first, then a retained kind."""
    found = [v for v in (row["text"].get(tier), row["hash"].get(tier)) if v is not None]
    return min(found, key=ORDER.index) if found else None


def _counts(values: Sequence[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items()))


def summarise(run: Mapping[str, Any], confidence: float) -> dict[str, Any]:
    """One backend and store: per tier, the residue rate, what is retained and the floor."""
    exposed = [r for r in run["canaries"] if r["role"] != "never"]
    never = [r for r in run["canaries"] if r["role"] == "never"]
    available = {t: True for t in LIVE_TIERS} | dict(run["byte_tiers"])
    tiers: dict[str, Any] = {}
    for tier in TIERS:
        if not available[tier]:
            tiers[tier] = None
            continue
        outcomes = [outcome(r, tier) for r in exposed]
        residue = [r for r, o in zip(exposed, outcomes, strict=True) if o == "residue"]
        tiers[tier] = {
            "residue": rate(len(residue), len(exposed), confidence),
            **(
                {
                    # inspeximus's split (docs/absorbed.md): bytes no live row
                    # or record holds any more, the storage engine's unzeroed
                    # pages, apart from bytes a live copy explains.
                    "residue_unreclaimed": sum(
                        1 for r in residue if all(outcome(r, t) != "residue" for t in LIVE_TIERS)
                    )
                }
                if tier in BYTE_TIERS
                else {}
            ),
            "residue_text": sum(1 for r in exposed if r["text"].get(tier) == "residue"),
            "residue_hash": sum(1 for r in exposed if r["hash"].get(tier) == "residue"),
            "residue_by_role": _counts([r["role"] for r in residue]),
            "retained_by_decision": {
                k: sum(1 for o in outcomes if o == k) for k in RETAINED if k in outcomes
            },
            "never_exposed_found": rate(
                sum(1 for r in never if outcome(r, tier) is not None), len(never), confidence
            ),
        }

    def anywhere(names: Sequence[str]) -> dict[str, Any]:
        hit = [r for r in exposed if any(outcome(r, t) == "residue" for t in names)]
        return {
            "residue": rate(len(hit), len(exposed), confidence),
            "residue_by_role": _counts([r["role"] for r in hit]),
            "never_exposed_found": rate(
                sum(1 for r in never if any(outcome(r, t) is not None for t in names)),
                len(never),
                confidence,
            ),
        }

    present = [t for t in TIERS if available[t]]
    return {
        "exposed": len(exposed),
        "never_exposed": len(never),
        "before": {
            t: sum(1 for r in exposed if t in r["before"])
            for t in ("projection", "events", "store-records")
        },
        "tiers": tiers,
        "live_tiers": anywhere(LIVE_TIERS),
        "byte_tiers": anywhere([t for t in BYTE_TIERS if available[t]]),
        "any_tier": anywhere(present),
        "deletion_reports": dict(sorted(run["reports"].items())),
        "searched": dict(sorted(run["searched"].items())),
        "summary_calls": dict(sorted(run["summary_calls"].items())),
    }


def run_check(backend: str, store: str, seed: int, cassettes: str) -> dict[str, Any]:
    """One backend and store, through node."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "outcome.json"
        # The log and the store, removed with the folder once node has exited.
        work = Path(tmp) / "work"
        work.mkdir()
        run_node(
            [
                ENTRY,
                "--backend",
                backend,
                "--store",
                store,
                "--seed",
                str(seed),
                "--cassettes",
                cassettes,
                "--out",
                str(out),
                "--work",
                str(work),
            ]
        )
        result: dict[str, Any] = json.loads(out.read_text(encoding="utf-8"))
        return result


def compute(
    config: Mapping[str, Any], runs: Mapping[str, Mapping[str, Any]] | None = None
) -> dict[str, Any]:
    """The result; `runs` (backend/store to the node outcome) skips node, for tests."""
    confidence = float(config.get("confidence", 0.95))
    seed = int(config["seed"])
    if runs is None:
        runs = {
            f"{b}/{s}": run_check(b, s, seed, str(config["cassettes"]))
            for b in config["backends"]
            for s in config["stores"]
        }
    outcomes = "".join(json.dumps(runs[k], sort_keys=True) + "\n" for k in sorted(runs))
    for key, run in runs.items():
        if run["summary_calls"].get("recorded", 0) != 0:
            raise ValueError(f"{key}: a run recorded summaries; a result replays its cassettes")
        if f"{run['backend']}/{run['store']}" != key or int(run["seed"]) != seed:
            raise ValueError(f"{key}: the outcome is of another run")
    summaries = {k: summarise(runs[k], confidence) for k in sorted(runs)}
    return {
        "name": config["name"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "proposal": config["proposal"],
        "registered": False,
        "decides": False,
        "policy": "packages/pi-package/profiles/twin.yaml",
        "persons": 20,
        "canaries_per_person": 10,
        "seed": seed,
        "confidence": confidence,
        "backends": list(config["backends"]),
        "stores": list(config["stores"]),
        "tiers": list(TIERS),
        "retained_kinds": list(RETAINED),
        "check": CHECK,
        "scan": SCAN,
        "cassettes": config["cassettes"],
        "outcomes_sha256": hashlib.sha256(outcomes.encode("utf-8")).hexdigest(),
        "runs": summaries,
        "limits": list(config["limits"]),
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
