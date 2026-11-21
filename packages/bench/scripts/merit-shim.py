"""MERIT's memory interface over Engram's HTTP API, and the driver that runs
MERIT's own harness with it (card B7).

The launcher (packages/bench/src/merit/launch.ts) writes a plan and runs

    <MERIT's environment>/python -I -B packages/bench/scripts/merit-shim.py <plan.json>

The plan names the checkout of merit-bench at the pin and, per cell, the
command line of MERIT's scripts/run_pilot.py and the memory it runs with.
For each cell the driver registers the shim in merit.memory.CONDITIONS, the
plug-in point MERIT documents (PINS.md: subclass MemoryBase and register it
in CONDITIONS), and calls run_pilot.py's main with that command line, so
MERIT's own loop, worlds, user turns, checkers and result rows run
unchanged. Nothing of MERIT is copied or edited here: it is imported from
the checkout.

The shim (EngramMemory) is MERIT's MemoryBase over one backend per arc:

- write(episode_id, transcript): the transcript in chunks of 600 characters
  (MERIT's own retrieval condition's chunk size, KeywordRAG.chunk_chars),
  each one episodic item in the actor's person scope, POSTed to <base>/items
  as /api/v1's WriteRequest ({actor, item}). Under C5 the actor's source is
  model, so the plane records the agent's writes as model-sourced, as the pi
  extension does for an agent's tool calls.
- read(current_context, budget_chars=4000): POST <base>/read with the
  context as the query; the items come back ranked by core's retrieval
  pipeline (cut to 20) and are joined in rank order with MERIT's separator
  ("\\n---\\n") while they fit the budget, as KeywordRAG.read joins its chunks.

Item ids are UUIDv7-shaped counters and valid_from is a fixed base plus one
second per item, so the same run sends the same bytes (AGENTS.md rule 7).
Standard library only, so it runs in MERIT's environment as it is installed.
"""

from __future__ import annotations

import hashlib
import json
import os
import runpy
import sys
import traceback
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from typing import Any

CHUNK_CHARS = 600
SEPARATOR = "\n---\n"


def _post(url: str, body: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST", headers={"content-type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            out: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
            return out
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{url}: HTTP {e.code}: {e.read().decode('utf-8', 'replace')}") from e


def _instant(base: str, seconds: int) -> str:
    start = datetime.strptime(base, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    return (start + timedelta(seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%S.") + "000Z"


def _item_id(n: int) -> str:
    return f"01920000-0000-7000-8000-{n:012d}"


def engram_condition(base_cls: type, spec: dict[str, Any]) -> type:
    """A MemoryBase subclass over the cell's backends, the k-th instance on the k-th."""
    bases: list[str] = list(spec["bases"])
    actor: dict[str, Any] = spec["actor"]
    valid_from_base: str = spec["valid_from_base"]
    opened = {"n": 0}

    class EngramMemory(base_cls):  # type: ignore[misc, valid-type]
        name = spec["key"]

        def __init__(self) -> None:
            super().__init__()
            k = opened["n"]
            opened["n"] += 1
            if k >= len(bases):
                raise RuntimeError(
                    f"memory {k + 1} asked for, and the launcher opened {len(bases)}"
                    " backends (one per arc)"
                )
            self.base = bases[k]
            self.written = 0

        def write(self, episode_id: str, transcript: str) -> None:
            for i in range(0, len(transcript), CHUNK_CHARS):
                chunk = transcript[i : i + CHUNK_CHARS]
                self.written += 1
                item = {
                    "id": _item_id(self.written),
                    "class": "episodic",
                    "scope": actor["memberships"][0],
                    "owner": actor["id"],
                    "content": chunk,
                    "provenance": {
                        "kind": "model",
                        "ref": f"merit:{episode_id}#{i // CHUNK_CHARS}",
                        "hash": "sha256:" + hashlib.sha256(chunk.encode("utf-8")).hexdigest(),
                        "actor": actor["id"],
                    },
                    "confidence": 0.5,
                    "valid_from": _instant(valid_from_base, self.written),
                    "valid_to": None,
                    "ttl": None,
                    "grants": [],
                    "version": 1,
                    "lineage": [],
                    "status": "active",
                    "store_ref": None,
                    "schema_version": 1,
                }
                _post(f"{self.base}/items", {"actor": actor, "item": item})

        def read(self, current_context: str, budget_chars: int = 4000) -> str:
            got = _post(f"{self.base}/read", {"actor": actor, "text": current_context})
            out: list[str] = []
            used = 0
            for item in got["items"]:
                text = item["content"] if isinstance(item["content"], str) else json.dumps(item)
                if used + len(text) > budget_chars:
                    break
                out.append(text)
                used += len(text)
            return SEPARATOR.join(out)

    return EngramMemory


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: merit-shim.py <plan.json>", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        plan = json.load(f)
    upstream: str = plan["upstream"]
    sys.path.insert(0, upstream)
    import merit.memory as memory  # the checkout at the pin

    pilot = runpy.run_path(os.path.join(upstream, "scripts", "run_pilot.py"), run_name="merit_pilot")
    for cell in plan["cells"]:
        spec = cell["memory"]
        if spec is not None:
            memory.CONDITIONS[spec["key"]] = engram_condition(memory.MemoryBase, spec)
        sys.argv = ["run_pilot.py", *cell["argv"]]
        print(f"merit-shim: cell {cell['name']}", flush=True)
        try:
            pilot["main"]()
        finally:
            if spec is not None:
                del memory.CONDITIONS[spec["key"]]
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
