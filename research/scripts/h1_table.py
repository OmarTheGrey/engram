"""The H1 table from a results file in the `h1-sessions/1` schema (research/analysis/h1.py).

Usage:
    uv run python research/scripts/h1_table.py --config research/configs/<name>.json \\
        --out research/results/h1-<name>.json

The config names the results file (`sessions`, a path from the repository
root), the primary model, the store, the bootstrap seed, and, once they exist,
H2 to H5's primary p-values (`other_primary_p`). No H1 run exists yet: this is
the command the H1 runs feed once the pre-registration is tagged.
"""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from analysis.h1 import H1Config, build_h1_table, read_sessions
from scripts.results_io import REPO, load_config, write_result


def compute(config: Mapping[str, Any]) -> dict[str, Any]:
    others = config.get("other_primary_p")
    table = build_h1_table(
        read_sessions(REPO / str(config["sessions"])),
        H1Config(
            primary_model=str(config["primary_model"]),
            store=str(config["store"]),
            seed=int(config["seed"]),
            other_primary_p=None
            if others is None
            else {str(k): float(v) for k, v in others.items()},
        ),
    )
    return {"name": config["name"], "sessions": config["sessions"], **table}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    write_result(args.out, compute(load_config(args.config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
