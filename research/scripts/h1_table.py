"""The H1 table from a results file in the `h1-sessions/2` schema (research/analysis/h1.py).

Usage:
    uv run python research/scripts/h1_table.py --config research/configs/<name>.json \\
        --out research/results/h1-<name>.json

The config names the results file (`sessions`, a path from the repository
root), the primary model, the store, the bootstrap seed, and, once they exist,
H2 to H5's primary p-values (`other_primary_p`). Optionally:

- `gatemem_primary`: the GateMem set the primary test runs on ("access",
  "forgetting" or "access and forgetting"; analysis.h1.GATEMEM_SETS). The
  other two sets are reported as secondary, unadjusted; only the primary
  GateMem p-value enters Holm. Absent, every GateMem session is primary.
- `sensitivity`: `{"name": ..., "items_from": <a results file with an
  "items" list>}`, for a sensitivity table on the primary set without those
  items (for example research/results/h1-refusal-leaks.json); the table
  records the file's sha256. It needs `gatemem_primary`.
- `gate_by_action`: false (the default) for the main, leak-only table; true
  for the gate-by-action table (research/configs/h1-table-gate-by-action.json,
  `make h1-table GATE_BY_ACTION=1`). The table records it and refuses
  sessions converted under the other setting.

No H1 run exists yet: this is the command the H1 runs feed once the
pre-registration is tagged (`make h1-table`).
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.h1 import H1Config, build_h1_table, read_sessions
from scripts.results_io import REPO, load_config, sha256_file, write_result


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    others = config.get("other_primary_p")
    sensitivity = config.get("sensitivity")
    items: frozenset[str] | None = None
    source: dict[str, Any] = {}
    if sensitivity is not None:
        path = REPO / str(sensitivity["items_from"])
        items = frozenset(str(i) for i in json.loads(path.read_text(encoding="utf-8"))["items"])
        source = {
            "sensitivity_items_from": {
                "file": sensitivity["items_from"],
                "sha256": sha256_file(path),
            }
        }
    table = build_h1_table(
        read_sessions(REPO / str(config["sessions"])),
        H1Config(
            primary_model=str(config["primary_model"]),
            store=str(config["store"]),
            seed=int(config["seed"]),
            other_primary_p=None
            if others is None
            else {str(k): float(v) for k, v in others.items()},
            gatemem_primary=None
            if config.get("gatemem_primary") is None
            else str(config["gatemem_primary"]),
            sensitivity_name=None if sensitivity is None else str(sensitivity["name"]),
            sensitivity_items=items,
            gate_by_action=bool(config.get("gate_by_action", False)),
        ),
    )
    return {"name": config["name"], "sessions": config["sessions"], **source, **table}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
