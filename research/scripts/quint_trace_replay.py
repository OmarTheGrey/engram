"""The Quint traces replayed on the Plane (card E1.8): a proof of concept, no hypothesis.

Usage:
    uv run python research/scripts/quint_trace_replay.py \\
        --config research/configs/quint-trace-replay.json \\
        --out research/results/h1-quint-trace-replay.json

The traces are the committed ITF files under the config's `traces` folder,
which `make verify-spec` regenerates from specs/replay.qnt at the config's
seed, count and length (one thread, so the seed fixes them). This script
replays each on real Plane handles over one SQLite log and the fake store
(packages/core/test/model/replay-report.ts, which runs replay.ts, the driver
the vitest test packages/core/test/model/trace-replay.test.ts uses) and
records, per trace, whether every compared state equals the model's and,
where one does not, the step and the finding of card E1.8 that explains it.
No model is called, the clock and ids are injected, and the result is the
same bytes on every run. It is a proof of concept on the model's own bounded
traces, not a hypothesis result: it decides nothing about H1 to H5, and is
filed under h1-* only because research/tests/test_prereg.py maps every
MANIFEST file to a hypothesis's glob.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, run_node, write_result

ENTRY = "packages/core/test/model/replay-report.ts"


def build(config: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    """The result: the config's generation echoed beside the replay's report."""
    totals = report["totals"]
    if totals["traces"] < int(config["min_traces"]):
        raise ValueError(f"{totals['traces']} random traces, fewer than {config['min_traces']}")
    unexplained = totals["diverged_by_finding"].get("unexplained", 0)
    unexplained += sum(1 for s in report["scenarios"].values() if s.get("finding") == "unexplained")
    if unexplained:
        raise ValueError(f"{unexplained} traces diverge with no finding to explain them")
    return {
        "card": config["card"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "generation": config["generation"],
        "traces_dir": config["traces"],
        **report,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "report.json"
        run_node(
            [
                ENTRY,
                "--traces",
                str(REPO / config["traces"]),
                "--prefix",
                config["generation"]["prefix"],
                "--out",
                str(raw),
            ]
        )
        report = json.loads(raw.read_text(encoding="utf-8"))
    write_result(args.out, build(config, report))


if __name__ == "__main__":
    main()
