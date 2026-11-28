"""Card E2.18: preset properties proved by Cedar's symbolic compiler, a proof of concept.

Usage:
    uv run python research/scripts/h2_cedar_properties.py \\
        --config research/configs/h2-cedar-properties.json \\
        --out research/results/h2-cedar-properties.json
    uv run python research/scripts/h2_cedar_properties.py \\
        --config research/configs/h2-cedar-properties.json --fetch-only

On card E2.12's Cedar export of the registered presets (ADR 0041),
tools/symcc/cli.ts writes one check per property, preset pair or preset, and
action: an implication between two Cedar policy sets, the left one carrying
the domain of requests Engram can express. tools/symcc (a Rust binary over
cedar-policy-symcc 0.8.1, built here with cargo from its committed
Cargo.lock) asks cvc5 1.4.2 whether each holds for every such request, and
returns a counterexample when one does not, which Cedar's own authorizer must
reproduce. tools/symcc/cli.ts then decodes each counterexample into an
Engram actor, item and time, checks that it encodes back to the same Cedar
request, and decides it with evaluateRead or evaluateWrite.

The result says, per check, whether it was proved or refuted, and for a
refuted one the counterexample both ways and whether the evaluator
reproduces it. The control property (`expect: fails`) must be refuted with a
counterexample the evaluator reproduces. The script writes the result, prints
every counterexample, and exits 1 when any check is not as the config
expects. Proofs hold modulo grants: the export flattens them (ADR 0041,
decision 5).

cvc5 is the pinned release: the CVC5 environment variable, else the binary
the config pins under .engram/upstream (fetched from the release at its
sha256 when missing, never under ENGRAM_OFFLINE=1), else `cvc5` on the PATH;
its version must be the pinned one. When cargo or cvc5 is missing the script
exits 3 and writes nothing, which make verify-policy reports as a skip. No
model is called and nothing here reads a registered result.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.results_io import REPO, load_config, write_result

CLI = "tools/symcc/cli.ts"
# The exit status when cargo or cvc5 is missing: make verify-policy skips on it.
MISSING = 3


class ToolMissing(Exception):
    """cargo or cvc5 cannot be found or fetched; make verify-policy skips on it."""


def platform_key() -> str:
    """The config's key for this machine's cvc5 asset: win32-amd64, linux-x86_64, darwin-arm64."""
    return f"{sys.platform}-{platform.machine().lower()}"


def pinned_cvc5(config: Mapping[str, Any], *, fetch: bool) -> Path | None:
    """The pinned cvc5 under .engram/upstream for this platform, fetched if missing and allowed."""
    cvc5 = config["tools"]["cvc5"]
    asset = cvc5["assets"].get(platform_key())
    if asset is None:
        return None
    root: Path = REPO / str(cvc5["upstream"])
    exe: Path = root / str(asset["exe"])
    if exe.exists():
        return exe
    if not fetch or os.environ.get("ENGRAM_OFFLINE") == "1":
        return None
    url = f"{cvc5['release']}/{asset['zip']}"
    with urllib.request.urlopen(url) as response:
        body = response.read()
    if hashlib.sha256(body).hexdigest() != asset["sha256"]:
        raise ValueError(f"fetch {url}: sha256 differs from the config's pin")
    root.mkdir(parents=True, exist_ok=True)
    archive = root / asset["zip"]
    archive.write_bytes(body)
    with zipfile.ZipFile(archive) as z:
        z.extractall(root)
    if not exe.exists():
        raise ValueError(f"{url} holds no {asset['exe']}")
    exe.chmod(0o755)
    return exe


def find_cvc5(config: Mapping[str, Any], *, fetch: bool) -> Path:
    """cvc5 at its pinned version: CVC5, else the pinned release, else the PATH."""
    candidates: list[Path] = []
    if os.environ.get("CVC5"):
        candidates.append(Path(os.environ["CVC5"]))
    else:
        pinned = pinned_cvc5(config, fetch=fetch)
        if pinned is not None:
            candidates.append(pinned)
        on_path = shutil.which("cvc5")
        if on_path:
            candidates.append(Path(on_path))
    want = f"cvc5 {config['tools']['cvc5']['version']} "
    for exe in candidates:
        if not exe.exists():
            continue
        first = subprocess.run(
            [str(exe), "--version"], capture_output=True, text=True, check=True
        ).stdout.splitlines()[0]
        if not first.startswith(want):
            raise ValueError(f"{exe} is {first!r}; the config pins {want.strip()}")
        return exe
    raise ToolMissing(
        "cvc5 is missing: set CVC5, put cvc5 on the PATH, or run this script with --fetch-only"
    )


def build_symcc(config: Mapping[str, Any]) -> Path:
    """Build tools/symcc from its committed Cargo.lock; the binary's path."""
    cargo = shutil.which("cargo")
    if cargo is None:
        raise ToolMissing("cargo is missing: install Rust (rustup) to build tools/symcc")
    manifest: Path = REPO / str(config["tools"]["symcc"]["manifest"])
    offline = ["--offline"] if os.environ.get("ENGRAM_OFFLINE") == "1" else []
    subprocess.run(
        [
            cargo,
            "build",
            "--release",
            "--locked",
            "--quiet",
            *offline,
            "--manifest-path",
            str(manifest),
        ],
        cwd=REPO,
        check=True,
    )
    exe = (
        manifest.parent
        / "target"
        / "release"
        / ("engram-symcc.exe" if sys.platform == "win32" else "engram-symcc")
    )
    if not exe.exists():
        raise FileNotFoundError(f"cargo built no {exe}")
    return exe


def sort_entities(cex: Mapping[str, Any]) -> dict[str, Any]:
    """A counterexample with its entities and their parents in one order.

    Cedar keeps entities in a hash map, so the order it writes them in varies.
    """
    out = dict(cex)
    entities = []
    for e in cex["entities"]:
        entities.append({**e, "parents": sorted(e["parents"], key=lambda u: (u["type"], u["id"]))})
    out["entities"] = sorted(entities, key=lambda e: (e["uid"]["type"], e["uid"]["id"]))
    return out


def assemble(
    config: Mapping[str, Any],
    job: Mapping[str, Any],
    answers: Sequence[Mapping[str, Any]],
    replays: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """The result: every check with its verdict, and every counterexample with its replay."""
    by_answer = {a["id"]: a for a in answers}
    by_replay = {r["id"]: r for r in replays}
    if set(by_answer) != {c["id"] for c in job["checks"]}:
        raise ValueError("the answers do not cover the job's checks one for one")
    properties = []
    totals = {"checks": 0, "proved": 0, "refuted": 0, "reproduced": 0, "as_expected": 0}
    for spec in config["properties"]:
        checks = []
        for c in (c for c in job["checks"] if c["property"] == spec["id"]):
            a = by_answer[c["id"]]
            entry: dict[str, Any] = {
                "id": c["id"],
                "action": c["action"],
                "left": c["left_preset"],
                "right": c["right_preset"] if c["right_preset"] is not None else "the property",
                "request_environments": a["envs"],
                "verdict": "proved" if a["holds"] else "refuted",
            }
            totals["checks"] += 1
            if a["holds"]:
                totals["proved"] += 1
                as_expected = spec["expect"] == "holds"
            else:
                totals["refuted"] += 1
                r = by_replay.get(c["id"])
                if r is None:
                    raise ValueError(f"{c['id']}: refuted with no replay")
                entry["counterexample"] = {
                    "cedar": sort_entities(a["counterexample"]),
                    "engram": r["engram"],
                    "decoded_faithfully": r["faithful"],
                    "decode_problems": r["problems"],
                    "evaluator": {
                        "left_allows": r["left_allows"],
                        "right_allows": r["right_allows"],
                    },
                    "reproduced": r["reproduced"],
                }
                totals["reproduced"] += 1 if r["reproduced"] else 0
                as_expected = spec["expect"] == "fails" and bool(r["reproduced"])
            entry["as_expected"] = as_expected
            totals["as_expected"] += 1 if as_expected else 0
            checks.append(entry)
        if not checks:
            raise ValueError(f"{spec['id']}: the job has no check for it")
        properties.append(
            {
                "id": spec["id"],
                "shape": spec["shape"],
                "statement": spec["statement"],
                "expect": spec["expect"],
                "checks": checks,
                "as_expected": all(c["as_expected"] for c in checks),
            }
        )
    return {
        "name": config["name"],
        "card": config["card"],
        "kind": config["kind"],
        "hypothesis": config["hypothesis"],
        "status": config["status"],
        "wording": config["wording"],
        "tools": {
            "cedar_policy_symcc": config["tools"]["symcc"]["version"],
            "cedar_policy": config["tools"]["symcc"]["cedar_policy"],
            "cvc5": config["tools"]["cvc5"]["version"],
        },
        "scope": {
            "grants": "flattened by the export (ADR 0041, decision 5): "
            "every proof holds modulo grants",
            "domain": job["domain"],
        },
        "exports": job["exports"],
        "properties": properties,
        "summary": {**totals, "all_as_expected": totals["as_expected"] == totals["checks"]},
    }


def report(result: Mapping[str, Any]) -> list[str]:
    """One line per check, and every counterexample in full, for the terminal."""
    lines = []
    for p in result["properties"]:
        for c in p["checks"]:
            mark = "as expected" if c["as_expected"] else "NOT AS EXPECTED"
            lines.append(f"{c['verdict']:8} {c['id']} ({mark})")
            if "counterexample" in c:
                x = c["counterexample"]
                engram = json.dumps(x["engram"], sort_keys=True)
                lines.append(f"  counterexample, as Engram reads it: {engram}")
                lines.append(
                    f"  evaluator: {c['left']} allows {x['evaluator']['left_allows']}, "
                    f"{c['right']} allows {x['evaluator']['right_allows']}; "
                    f"reproduced {x['reproduced']}; decoded faithfully {x['decoded_faithfully']}"
                )
                for problem in x["decode_problems"]:
                    lines.append(f"  decode: {problem}")
    s = result["summary"]
    lines.append(
        f"{s['checks']} checks: {s['proved']} proved, {s['refuted']} refuted "
        f"({s['reproduced']} reproduced by the evaluator); {s['as_expected']} as expected"
    )
    return lines


def run(config_path: Path) -> dict[str, Any]:
    config = load_config(config_path)
    cvc5 = find_cvc5(config, fetch=True)
    symcc = build_symcc(config)
    with tempfile.TemporaryDirectory() as tmp:
        job_path, answers_path, replay_path = (
            Path(tmp) / n for n in ("job.json", "answers.json", "replay.json")
        )
        subprocess.run(
            ["node", CLI, "job", "--config", str(config_path), "--out", str(job_path)],
            cwd=REPO,
            check=True,
        )
        answers = subprocess.run(
            [str(symcc), str(job_path)],
            cwd=REPO,
            check=True,
            capture_output=True,
            text=True,
            env={**os.environ, "CVC5": str(cvc5)},
        ).stdout
        answers_path.write_text(answers, encoding="utf-8", newline="\n")
        subprocess.run(
            [
                "node",
                CLI,
                "replay",
                "--job",
                str(job_path),
                "--answers",
                str(answers_path),
                "--out",
                str(replay_path),
            ],
            cwd=REPO,
            check=True,
        )
        job = json.loads(job_path.read_text(encoding="utf-8"))
        replays = json.loads(replay_path.read_text(encoding="utf-8"))
    return assemble(config, job, json.loads(answers)["checks"], replays)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--fetch-only", action="store_true", help="fetch the pinned cvc5 and stop")
    args = parser.parse_args(argv)
    if not args.fetch_only and args.out is None:
        parser.error("--out is required")
    try:
        if args.fetch_only:
            print(find_cvc5(load_config(args.config), fetch=True))
            return 0
        result = run(args.config)
    except ToolMissing as e:
        print(f"h2_cedar_properties: {e}", file=sys.stderr)
        return MISSING
    write_result(args.out, result)
    print("\n".join(report(result)))
    return 0 if result["summary"]["all_as_expected"] else 1


if __name__ == "__main__":
    sys.exit(main())
