# Copied data from OWASP Agent Memory Guard
# (https://github.com/OWASP/www-project-agent-memory-guard), commit
# b052787cc3426ff5f5f7e8e0eecb514052a168ba, src/agent_memory_guard/bench/scenarios.py,
# Apache License 2.0, Copyright 2026 OWASP Foundation (NOTICE). Taken: the
# AMSB scenario corpus as data (ids, families, severities, descriptions,
# steps, probe keys, canaries) and the severity weights. Nothing else.
"""Vendors OWASP's AMSB scenario corpus as data (card X14).

This script never executes upstream code. It reads `scenarios.py` with `ast`
and evaluates only literal values: strings, implicit concatenations, the one
named fragment pair (`_GH_FAKE`, upstream's fake GitHub token assembled from
two literals so the literal never appears in source) and the one repeated
payload (`"..." * 5000`). A value built from parts is written as its parts and
a repeated one as its unit and count, so the vendored file carries neither the
token's literal nor 150,000 characters; packages/bench/src/amsb/load.ts
assembles both.

    python -I packages/bench/scripts/vendor-amsb.py \\
        --upstream .engram/upstream/amsb --fetch --out fixtures/bench/amsb

--fetch downloads scenarios.py and LICENSE.md at the pinned commit into
--upstream when missing (HTTPS, data only; never a model). The output records
the sha256 of both, and the script fails unless the corpus holds 21 scenarios,
15 attacks and 6 benign controls, the counts card R2 read at the commit.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import urllib.request
from pathlib import Path
from typing import Any

REPOSITORY = "https://github.com/OWASP/www-project-agent-memory-guard"
COMMIT = "b052787cc3426ff5f5f7e8e0eecb514052a168ba"
SCENARIOS = "src/agent_memory_guard/bench/scenarios.py"
LICENSE = "LICENSE.md"
RAW = f"https://raw.githubusercontent.com/OWASP/www-project-agent-memory-guard/{COMMIT}"
EXPECTED = {"total": 21, "malicious": 15, "benign": 6}


def fetch(upstream: Path) -> None:
    for path in (SCENARIOS, LICENSE):
        target = upstream / Path(path).name
        if target.exists():
            continue
        if os.environ.get("ENGRAM_OFFLINE") == "1":
            raise RuntimeError(f"{target} is missing and ENGRAM_OFFLINE=1 forbids the fetch")
        with urllib.request.urlopen(f"{RAW}/{path}") as response:
            body = response.read()
        upstream.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Literals:
    """Evaluates the literal expressions scenarios.py builds its corpus from."""

    def __init__(self, module: ast.Module) -> None:
        self.names: dict[str, ast.expr] = {}
        self.lists: dict[str, list[ast.expr]] = {}
        for node in module.body:
            target: ast.expr | None = None
            value: ast.expr | None = None
            if isinstance(node, ast.Assign) and len(node.targets) == 1:
                target, value = node.targets[0], node.value
            elif isinstance(node, ast.AnnAssign) and node.value is not None:
                target, value = node.target, node.value
            if not isinstance(target, ast.Name) or value is None:
                continue
            if isinstance(value, ast.List):
                self.lists[target.id] = list(value.elts)
            else:
                self.names[target.id] = value
        self.weights = {
            self.severity(k): int(ast.literal_eval(v))
            for k, v in zip(
                self.dict_node("SEVERITY_WEIGHT").keys,
                self.dict_node("SEVERITY_WEIGHT").values,
                strict=True,
            )
            if k is not None
        }

    def dict_node(self, name: str) -> ast.Dict:
        node = self.names[name]
        if not isinstance(node, ast.Dict):
            raise ValueError(f"{name} is not a dict literal")
        return node

    @staticmethod
    def severity(node: ast.expr) -> str:
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "Severity"
        ):
            return node.attr.lower()
        raise ValueError(f"not a Severity member: {ast.dump(node)}")

    def parts(self, node: ast.expr) -> list[str]:
        """A string expression as the literal parts it concatenates."""
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return [node.value]
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return self.parts(node.left) + self.parts(node.right)
        if isinstance(node, ast.Name) and node.id in self.names:
            return self.parts(self.names[node.id])
        raise ValueError(f"not a string literal: {ast.dump(node)}")

    def text(self, node: ast.expr) -> Any:
        """A string, `{"parts": [...]}` when built from a named fragment, or `{"repeat", "unit"}`."""
        node = node.elts[0] if isinstance(node, ast.Tuple) and len(node.elts) == 1 else node
        if (
            isinstance(node, ast.BinOp)
            and isinstance(node.op, ast.Mult)
            and isinstance(node.right, ast.Constant)
            and isinstance(node.right.value, int)
        ):
            unit = "".join(self.parts(node.left))
            return {"repeat": node.right.value, "unit": unit}
        named = any(isinstance(n, ast.Name) for n in ast.walk(node))
        parts = self.parts(node)
        if not named:
            return "".join(parts)
        # The fragment pair stays split, so the token's literal is not in the file.
        return {"parts": parts}

    def scenario(self, call: ast.expr) -> dict[str, Any]:
        if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
            raise ValueError(f"not a scenario call: {ast.dump(call)}")
        args = list(call.args)
        kw = {k.arg: k.value for k in call.keywords if k.arg is not None}
        if call.func.id == "_attack":
            names = ["id", "category", "severity", "description", "key", "payload", "canary"]
            got = dict(zip(names, args, strict=False)) | kw
            return {
                "id": ast.literal_eval(got["id"]),
                "category": ast.literal_eval(got["category"]),
                "severity": self.severity(got["severity"]),
                "description": ast.literal_eval(got["description"]),
                "steps": [
                    {
                        "key": ast.literal_eval(got["key"]),
                        "value": self.text(got["payload"]),
                        "source_class": ast.literal_eval(got["source_class"])
                        if "source_class" in got
                        else "external_tool",
                    }
                ],
                "probe_key": ast.literal_eval(got["key"]),
                "canary": self.text(got["canary"]),
                "malicious": True,
            }
        if call.func.id == "_benign":
            names = ["id", "description", "key", "value"]
            got = dict(zip(names, args, strict=False)) | kw
            return {
                "id": ast.literal_eval(got["id"]),
                "category": "benign",
                "severity": "low",
                "description": ast.literal_eval(got["description"]),
                "steps": [
                    {
                        "key": ast.literal_eval(got["key"]),
                        "value": self.text(got["value"]),
                        "source_class": "user_input",
                    }
                ],
                "probe_key": ast.literal_eval(got["key"]),
                "canary": "",
                "malicious": False,
            }
        raise ValueError(f"unknown scenario builder {call.func.id}")


def corpus_order(module: ast.Module) -> list[str]:
    """The list names default_corpus() returns, in its order."""
    for node in module.body:
        if isinstance(node, ast.FunctionDef) and node.name == "default_corpus":
            for stmt in node.body:
                if isinstance(stmt, ast.Return) and isinstance(stmt.value, ast.List):
                    out = []
                    for e in stmt.value.elts:
                        if not (isinstance(e, ast.Starred) and isinstance(e.value, ast.Name)):
                            raise ValueError("default_corpus returns something but lists")
                        out.append(e.value.id)
                    return out
    raise ValueError("default_corpus not found")


def vendor(upstream: Path) -> dict[str, Any]:
    source = upstream / Path(SCENARIOS).name
    module = ast.parse(source.read_text(encoding="utf-8"))
    lit = Literals(module)
    scenarios = [lit.scenario(c) for name in corpus_order(module) for c in lit.lists[name]]
    counts = {
        "total": len(scenarios),
        "malicious": sum(1 for s in scenarios if s["malicious"]),
        "benign": sum(1 for s in scenarios if not s["malicious"]),
    }
    if counts != EXPECTED:
        raise ValueError(f"AMSB at {COMMIT[:12]}: {counts}, expected {EXPECTED}")
    return {
        "description": (
            "OWASP Agent Memory Guard's AMSB scenario corpus, copied as data by "
            "packages/bench/scripts/vendor-amsb.py from the commit below (Apache-2.0, "
            "Copyright 2026 OWASP Foundation; NOTICE). A value built from parts "
            "or repeated is kept as its parts or its unit and count; "
            "packages/bench/src/amsb/load.ts assembles it."
        ),
        "source": {
            "repository": REPOSITORY,
            "commit": COMMIT,
            "path": SCENARIOS,
            "licence": "Apache-2.0",
            "copyright": "Copyright 2026 OWASP Foundation",
            "upstream_sha256": {SCENARIOS: sha256(source), LICENSE: sha256(upstream / LICENSE)},
        },
        "counts": counts,
        "severity_weight": lit.weights,
        "scenarios": scenarios,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()
    if args.fetch:
        fetch(args.upstream)
    data = vendor(args.upstream)
    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / "scenarios.json").open("w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
