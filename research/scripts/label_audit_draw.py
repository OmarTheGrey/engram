"""The label audit's seeded draw as a committed record, with no label in it (card RV8, RV-DES-17).

Usage:
    uv run python research/scripts/label_audit_draw.py \\
        --config research/configs/label-audit-longmemeval.json \\
        --out research/results/h2-label-audit-longmemeval.json \
        [--key-out .engram/audit-longmemeval/draw-key.json]

The sampler (research/scripts/label_audit_sample.py `draw`) is the only place
the audit's items are drawn; this script records what it drew so the sheets
the members fill can be checked against a committed result: per benchmark the
number of items, each reference's context-file sha256, and one sha256 over
every item's reference, id, kind, label and keys in order (`draw_sha256`). No
item id, kind, label or key appears by reference, and no count per kind
either: the three members (Omar, Mohamad and Shady) read this repository during
the audit, and a count per kind gives away how many items are unanswerable or
attacks (review finding RV8-6). The counts go in a key, written with `--key-out`
under `.engram/` or outside the repository, for the one who runs the audit and
not for the members (`compute_key`). The rejection rule and the stop come from the config
(`reject_quorum`, `stop_share`, `on_stop`) and are recorded beside the draw,
with the share as a count of the benchmark's items.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.label_audit_sample import AuditItem, check_out_dir, draw
from scripts.results_io import load_config, write_result


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def record(items: Sequence[AuditItem], stop_share: float) -> dict[str, Any]:
    """One benchmark's draw: context hashes by reference, a hash over the hidden fields."""
    joined = "".join(
        json.dumps([i.ref, i.item, i.kind, i.label, list(i.keys)], ensure_ascii=False) + "\n"
        for i in items
    )
    return {
        "items": len(items),
        "context_sha256": {i.ref: _sha(i.context_text) for i in items},
        "draw_sha256": _sha(joined),
        # More than stop_share of the items: the smallest count of rejected items that stops.
        "stop_at_rejected": math.floor(stop_share * len(items)) + 1,
    }


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    stop_share = float(config["stop_share"])
    drawn = draw(config)
    return {
        "name": config["name"],
        "hypothesis": config["hypothesis"],
        "seed": config["seed"],
        "members": list(config["members"]),
        "reject_quorum": int(config["reject_quorum"]),
        "stop_share": stop_share,
        "on_stop": config["on_stop"],
        "benchmarks": {b: record(items, stop_share) for b, items in sorted(drawn.items())},
    }


def compute_key(config: Mapping[str, Any]) -> dict[str, Any]:
    """The count per kind of each draw: for the one who runs the audit, not the members."""
    drawn = draw(config)
    return {
        "name": config["name"],
        "seed": config["seed"],
        "benchmarks": {
            b: {"by_kind": dict(sorted(Counter(i.kind for i in items).items()))}
            for b, items in sorted(drawn.items())
        },
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--key-out", type=Path, help="the counts per kind, never under results/")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if args.key_out is not None:
        check_out_dir(args.key_out)
    write_result(args.out, compute(config))
    if args.key_out is not None:
        write_result(args.key_out, compute_key(config))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
