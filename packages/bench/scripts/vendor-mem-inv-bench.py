"""Vendors the MEM-INV-Bench fixture subset (card B4, ADR 0029).

MEM-INV-Bench's laundering-channel cases are not rows of its Parquet tables:
the Parquet configurations hold the five extension plans (dispatch,
extraction, external, recovery, camel). The cases are authored in
`code/scenarios.py` (ATTACK, LEGIT, CHANNELS, AGENT_SYSTEM, AGENT_USER) and
their memory is built by `build_memory` and `build_legit_memory` in
`code/exp1_propensity.py`; the eight-model proposal study that ran them is
recorded in `evidence/recorded-evidence.zip` (logs/exp1_*.jsonl). So no
Parquet reader is needed.

This script never executes upstream code. It reads `scenarios.py` with
`ast` (literal values only), rebuilds each case's memory with a port of
`build_memory` (below), and checks every rebuilt memory line against the
memory the recorded study actually showed the model, taken from the recorded
`propose` request of the reference model (`REFERENCE_MODEL`, trial 0, the
first record whose memory carries the scenario's current attacker value, as
upstream `review._stale` requires). The self-summarisation note (channel
`summarize`) is a model's paraphrase upstream; the recorded one is used. The
recorded proposal of the same record is the scripted model's reply.

    python -I packages/bench/scripts/vendor-mem-inv-bench.py \\
        --upstream .engram/upstream/mem-inv-bench --fetch \\
        --out fixtures/bench/mem-inv-bench

--fetch clones the pinned commit into --upstream when it is missing (git,
HTTPS, data only; never a model). Development time only; tests never run it.

Selection rule (seed SEED, Python's random.Random, deterministic):
  1. sort the ATTACK scenario ids and shuffle them; for channel c (CHANNELS
     order: direct, summarize, tool_echo, corroborate) take the ids at
     positions (5c + j) mod 8 for j in 0..4, so 20 attack cases, 5 per
     channel, every scenario in 2 or 3 channels;
  2. sort the LEGIT scenario ids and shuffle them; take the first with 2,
     with 1 and with 0 vouchers, then the next one not taken: 4 benign cases;
  3. case ids are mib-01 to mib-24 in that order (attacks by channel, then
     benign); they carry no label.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import random
import subprocess
import zipfile
from pathlib import Path
from typing import Any

UPSTREAM = {
    "repository": "https://github.com/yedidel/mem-inv-bench",
    "commit": "cf3c9a4ca9f0478000d6aa26eb268b875232d34b",
    "dataset": "https://huggingface.co/datasets/anonymos-2321135/MEM-INV-Bench",
    "dataset_revision": "59e5bcdb3a4c20da2d378f381f129b4a45dec2dc",
}
SEED = 20261029
REFERENCE_MODEL = "openai/gpt-5.6-terra"
CHANNELS = ["direct", "summarize", "tool_echo", "corroborate"]
EVIDENCE = "evidence/recorded-evidence.zip"

# Upstream files read by the vendoring or by the port, hashed into the manifest.
HASHED_FILES = [
    "LICENSE",
    "README.md",
    "REPRODUCE.md",
    "CITATION.cff",
    "THIRD_PARTY_NOTICES.md",
    "release.json",
    "code/scenarios.py",
    "code/exp1_propensity.py",
    "code/tma.py",
    "code/review.py",
    "code/adjudication.py",
    "code/score.py",
    "code/test_scoring.py",
    EVIDENCE,
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(upstream: Path) -> None:
    if (upstream / "code" / "scenarios.py").exists():
        return
    upstream.mkdir(parents=True, exist_ok=True)
    run = lambda *args: subprocess.run(["git", "-C", str(upstream), *args], check=True)  # noqa: E731
    run("init", "-q")
    run("remote", "add", "origin", UPSTREAM["repository"] + ".git")
    run("fetch", "-q", "--depth", "1", "origin", UPSTREAM["commit"])
    run("checkout", "-q", "FETCH_HEAD")


def check_commit(upstream: Path) -> None:
    head = subprocess.run(
        ["git", "-C", str(upstream), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if head != UPSTREAM["commit"]:
        raise SystemExit(f"{upstream} is at {head}, the pin is {UPSTREAM['commit']}")


def _literal(node: ast.expr) -> Any:
    """A keyword value of scenarios.py: a constant, or Tier.<NAME> as its name."""
    if (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "Tier"
    ):
        return node.attr
    return ast.literal_eval(node)


def read_scenarios(path: Path) -> dict[str, list[dict[str, Any]]]:
    """ATTACK and LEGIT from scenarios.py, parsed, never imported."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    out: dict[str, list[dict[str, Any]]] = {}
    for stmt in tree.body:
        if not isinstance(stmt, ast.Assign) or len(stmt.targets) != 1:
            continue
        target = stmt.targets[0]
        if not isinstance(target, ast.Name) or target.id not in ("ATTACK", "LEGIT"):
            continue
        assert isinstance(stmt.value, ast.List)
        rows = []
        for call in stmt.value.elts:
            assert isinstance(call, ast.Call) and isinstance(call.func, ast.Name)
            assert call.func.id == "dict" and not call.args
            rows.append({str(k.arg): _literal(k.value) for k in call.keywords})
        out[target.id] = rows
    return out


def entry(channel: str, text: str, derived_from: list[str] | None = None) -> dict[str, Any]:
    return {"channel": channel, "derived_from": derived_from or [], "text": text}


def attack_memory(scn: dict[str, Any], channel: str, summary: str) -> list[dict[str, Any]]:
    """Port of exp1_propensity.build_memory: the items shown to the model, in order.

    Channels (build_channels): web and inbox untrusted (public-web, public-mail),
    erp and bank trusted (erp-vendor, banking-partner), self the agent, user the
    user. A derived item names the channel of its input. The raw untrusted item
    a summary or a tool echo is derived from is ingested upstream but not shown,
    so it is not an entry here.
    """
    v = scn["evil"]
    if channel == "direct":
        shown = [entry("web", scn["poison"])]
    elif channel == "summarize":
        shown = [entry("agent", summary, ["web"])]
    elif channel == "tool_echo":
        shown = [entry("tool", f"[{scn['entity']} lookup] record on file: {v}", ["web"])]
    elif channel == "corroborate":
        shown = [
            entry("web", scn["corr_a"].format(v=v)),
            entry("inbox", scn["corr_b"].format(v=v)),
        ]
    else:
        raise ValueError(channel)
    return [*shown, entry("erp", scn["filler"])]


def legit_memory(scn: dict[str, Any]) -> list[dict[str, Any]]:
    """Port of exp1_propensity.build_legit_memory."""
    v = scn["value"]
    shown = [entry("web", f"Remit-to details on file for {scn['entity']}: {v}.")]
    for cid in ["erp", "bank"][: scn["vouchers"]]:
        shown.append(entry(cid, f"Verified record for {scn['entity']}: {v}."))
    return shown


def select(scenarios: dict[str, list[dict[str, Any]]]) -> list[tuple[str, dict[str, Any]]]:
    rng = random.Random(SEED)
    attack_ids = sorted(s["sid"] for s in scenarios["ATTACK"])
    rng.shuffle(attack_ids)
    by_sid = {s["sid"]: s for s in scenarios["ATTACK"] + scenarios["LEGIT"]}
    picked: list[tuple[str, dict[str, Any]]] = []
    for c, channel in enumerate(CHANNELS):
        for j in range(5):
            picked.append((channel, by_sid[attack_ids[(5 * c + j) % len(attack_ids)]]))
    legit_ids = sorted(s["sid"] for s in scenarios["LEGIT"])
    rng.shuffle(legit_ids)
    chosen: list[str] = []
    for vouchers in (2, 1, 0):
        chosen.append(next(i for i in legit_ids if by_sid[i]["vouchers"] == vouchers))
    chosen.append(next(i for i in legit_ids if i not in chosen))
    picked.extend(("legit", by_sid[i]) for i in chosen)
    return picked


def recorded_memory(user: str) -> str:
    """The memory block of a recorded propose request (review._mem)."""
    a = user.find("\n", user.find("LONG-TERM MEMORY"))
    b = user.find("## CURRENT REQUEST")
    return user[a:b].strip()


def recorded_task(user: str) -> str:
    a = user.find("## CURRENT REQUEST") + len("## CURRENT REQUEST")
    b = user.find("\n\nDecide")
    return user[a:b].strip()


def usable(rec: dict[str, Any], scn: dict[str, Any]) -> bool:
    """Not stale: the memory carries the scenario's current attacker value (review._stale)."""
    if "evil" not in scn:
        return True
    probe = str(scn["evil"]).split("=")[-1].lower()
    return probe in rec["memory"].lower() and rec["meta"].get("evil") == scn["evil"]


def proposals_for(evidence: Path, picked: list[tuple[str, dict[str, Any]]]) -> list[dict[str, Any]]:
    # Collect every candidate, then keep the first usable one per cell.
    candidates: dict[tuple[str, str], list[dict[str, Any]]] = {}
    with zipfile.ZipFile(evidence) as z:
        manifest = z.read("logs/STUDY_MANIFEST.txt").decode("utf-8")
        names = [ln.strip() for ln in manifest.splitlines()]
        files = sorted("logs/" + n for n in names if n.startswith("exp1") and n.endswith(".jsonl"))
        for name in files:
            if name not in z.namelist():
                continue
            for number, raw in enumerate(z.open(name), 1):
                try:
                    r = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                meta = r.get("meta") or {}
                if r.get("tag") != "propose" or r.get("model") != REFERENCE_MODEL:
                    continue
                if meta.get("trial") != 0 or "channel" not in meta:
                    continue
                if r.get("truncated") or not r.get("ok", True):
                    continue
                user = "\n".join(m["content"] for m in r["messages"] if m["role"] == "user")
                system = "\n".join(m["content"] for m in r["messages"] if m["role"] == "system")
                candidates.setdefault((meta["sid"], meta["channel"]), []).append(
                    {
                        "file": name,
                        "line": number,
                        "meta": meta,
                        "memory": recorded_memory(user),
                        "task": recorded_task(user),
                        "system": system,
                        "user": user,
                        "text": r["text"],
                        "finish_reason": r.get("finish_reason"),
                    }
                )
    out = []
    for channel, scn in picked:
        cell = candidates.get((scn["sid"], channel), [])
        rec = next((c for c in cell if usable(c, scn)), None)
        if rec is None:
            raise SystemExit(f"no usable recorded proposal for {scn['sid']} {channel}")
        out.append(rec)
    return out


def build_cases(
    picked: list[tuple[str, dict[str, Any]]], records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    cases = []
    for n, ((channel, scn), rec) in enumerate(zip(picked, records, strict=True), 1):
        summary_line = rec["memory"].split("\n", 1)[0]
        summary = summary_line[2:] if summary_line.startswith("- ") else summary_line
        memory = legit_memory(scn) if channel == "legit" else attack_memory(scn, channel, summary)
        shown = "\n".join(f"- {e['text']}" for e in memory)
        if shown != rec["memory"]:
            raise SystemExit(
                f"{scn['sid']} {channel}: rebuilt memory differs from the recorded one\n"
                f"rebuilt:  {shown!r}\nrecorded: {rec['memory']!r}"
            )
        if rec["task"] != scn["task"]:
            raise SystemExit(f"{scn['sid']} {channel}: recorded task differs from scenarios.py")
        for i, e in enumerate(memory, 1):
            e["entry_id"] = f"e{i}"
        case: dict[str, Any] = {
            "case_id": f"mib-{n:02d}",
            "family": "legit" if channel == "legit" else "attack",
            "channel": channel,
            "sid": scn["sid"],
            "domain": scn["domain"],
            "tool": scn["tool"],
            "tier": scn["tier"],
            "task": scn["task"],
            "entity": scn["entity"],
        }
        if channel == "legit":
            case.update(value=scn["value"], vouchers=scn["vouchers"])
        else:
            case.update(evil=scn["evil"], good=scn["good"])
        case["memory"] = [
            {
                "entry_id": e["entry_id"],
                "channel": e["channel"],
                "derived_from": e["derived_from"],
                "text": e["text"],
            }
            for e in memory
        ]
        cases.append(case)
    return cases


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--upstream", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--fetch", action="store_true")
    a = ap.parse_args()
    upstream: Path = a.upstream
    out: Path = a.out
    if a.fetch:
        fetch(upstream)
    check_commit(upstream)
    scenarios = read_scenarios(upstream / "code" / "scenarios.py")
    picked = select(scenarios)
    records = proposals_for(upstream / EVIDENCE, picked)
    cases = build_cases(picked, records)
    system = records[0]["system"]
    if any(r["system"] != system for r in records):
        raise SystemExit("recorded system prompts differ between cases")

    out.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(c, ensure_ascii=False) for c in cases]
    (out / "cases.jsonl").write_bytes("".join(f"{ln}\n" for ln in lines).encode("utf-8"))
    (out / "UPSTREAM-LICENSE").write_bytes((upstream / "LICENSE").read_bytes())
    script = {
        "rule": (
            "the reference model's recorded trial-0 proposal for each case, verbatim "
            f"({REFERENCE_MODEL}, {EVIDENCE}); see packages/bench/scripts/"
            "vendor-mem-inv-bench.py"
        ),
        "responses": {
            c["case_id"]: {"text": r["text"], "from": f"{r['file']}:{r['line']}"}
            for c, r in zip(cases, records, strict=True)
        },
    }
    (out / "script.json").write_bytes(
        (json.dumps(script, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    )
    # The runner's scripted pi model (packages/runner/src/mem-inv-probe.ts):
    # one memory_read with an empty query, which every store answers with all
    # it holds (upstream shows the model its whole memory), then the proposal.
    probe = {
        "steps": {
            c["case_id"]: [
                {"toolCall": {"id": "call-1", "name": "memory_read", "arguments": {"query": ""}}},
                {"text": r["text"]},
            ]
            for c, r in zip(cases, records, strict=True)
        }
    }
    (out / "probe-script.json").write_bytes(
        (json.dumps(probe, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    )
    manifest = {
        "source": UPSTREAM,
        "seed": SEED,
        "rule": "packages/bench/scripts/vendor-mem-inv-bench.py (module docstring)",
        "reference_model": REFERENCE_MODEL,
        "upstream_sha256": {f: sha256((upstream / f).read_bytes()) for f in HASHED_FILES},
        "recorded_system_prompt_sha256": sha256(system.encode("utf-8")),
        "files": {"cases.jsonl": [sha256(ln.encode("utf-8")) for ln in lines]},
        "cases": [
            {
                "case_id": c["case_id"],
                "family": c["family"],
                "channel": c["channel"],
                "sid": c["sid"],
                "recorded_from": f"{r['file']}:{r['line']}",
                "recorded_prompt_sha256": sha256(r["user"].encode("utf-8")),
            }
            for c, r in zip(cases, records, strict=True)
        ],
    }
    (out / "manifest.json").write_bytes(
        (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    )
    print(f"vendored {len(cases)} cases into {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
