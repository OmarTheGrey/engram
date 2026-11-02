"""`make test-repro`: every row of research/results/MANIFEST.md regenerates to its sha256.

Usage: uv run python research/scripts/reproduce.py [--root DIR]

For each row (file, config, script, commit, sha256, figure) the script is run
as `python <script> --config <config> --out <temporary file>` from the
repository root, and the sha256 of what it wrote must equal the row's; the
committed file must hash to the row's as well. Rows run in manifest order and
every row is checked before the exit status is decided: 0 when all match, 1
when any differs or fails. A script that needs pinned upstream data fetches
it into .engram/upstream (data only, never a model), so this may need the
network on a fresh clone; CI does not run it (plan decision 10 of
docs/tasks/prereg-v1-plan.md).
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MANIFEST = "research/results/MANIFEST.md"


@dataclass(frozen=True)
class Row:
    file: str
    config: str
    script: str
    commit: str
    sha256: str
    figure: str


def manifest_rows(text: str) -> list[Row]:
    """The manifest's result rows: table lines whose first cell is under research/results/."""
    rows: list[Row] = []
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 6 and cells[0].startswith("research/results/"):
            rows.append(Row(*cells))
    return rows


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_row(root: Path, row: Row) -> list[str]:
    """Rerun one row; the problems found, empty when it reproduces."""
    problems: list[str] = []
    committed = root / row.file
    if not committed.exists():
        problems.append(f"{row.file}: the committed file is missing")
    elif _sha256(committed) != row.sha256:
        problems.append(f"{row.file}: the committed file's sha256 differs from the manifest")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / Path(row.file).name
        run = subprocess.run(
            [sys.executable, row.script, "--config", row.config, "--out", str(out)],
            cwd=root,
            check=False,
        )
        if run.returncode != 0:
            problems.append(f"{row.file}: {row.script} exited with {run.returncode}")
        elif not out.exists():
            problems.append(f"{row.file}: {row.script} wrote nothing")
        elif (got := _sha256(out)) != row.sha256:
            problems.append(f"{row.file}: regenerated sha256 {got} differs from {row.sha256}")
    return problems


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=REPO)
    args = parser.parse_args(argv)
    root: Path = args.root.resolve()
    rows = manifest_rows((root / MANIFEST).read_text(encoding="utf-8"))
    if not rows:
        print(f"test-repro: {MANIFEST} lists no results")
        return 0
    failed = 0
    for row in rows:
        print(f"test-repro: {row.file} from {row.script} {row.config}", flush=True)
        problems = check_row(root, row)
        for p in problems:
            print(f"test-repro: FAIL {p}", flush=True)
        if problems:
            failed += 1
        else:
            print(f"test-repro: ok {row.file} {row.sha256}", flush=True)
    print(f"test-repro: {len(rows) - failed} of {len(rows)} results reproduce")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
