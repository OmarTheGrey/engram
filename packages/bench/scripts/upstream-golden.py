"""Golden outputs from GateMem's own code, for the port's fidelity test (card B1).

Runs upstream's LongContextAgent through upstream's run_episode on the
vendored fixture subset, with a fake router that answers from the fixture's
script.json, and scores with upstream's rule-based score_one and aggregate.
Writes the prompt hashes, parsed outputs and scores the TypeScript port must
reproduce (packages/bench/test/gatemem/upstream.test.ts). Development time only:

    python -I packages/bench/scripts/upstream-golden.py \
        --upstream <dir with GateMem files at a983828> \
        --fixtures fixtures/bench/gatemem \
        --out fixtures/bench/gatemem/upstream-golden.json

Only the modules it needs are loaded: the package __init__ files are replaced
by empty modules, so bench/agents/__init__.py (which imports every baseline
and their third-party dependencies) never runs, and tqdm is stubbed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import types
from pathlib import Path
from typing import Any


def _install_stubs(upstream: Path) -> None:
    for name, sub in [
        ("bench", "bench"),
        ("bench.agents", "bench/agents"),
        ("bench.eval", "bench/eval"),
        ("bench.llm", "bench/llm"),
    ]:
        mod = types.ModuleType(name)
        mod.__path__ = [str(upstream / sub)]
        sys.modules[name] = mod
    tqdm = types.ModuleType("tqdm")

    class _Tqdm:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def update(self, n: int = 1) -> None:
            pass

        def close(self) -> None:
            pass

    tqdm.tqdm = _Tqdm  # type: ignore[attr-defined]
    sys.modules["tqdm"] = tqdm
    sys.path.insert(0, str(upstream))


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--upstream", required=True)
    p.add_argument("--fixtures", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    upstream = Path(args.upstream).resolve()
    fixtures = Path(args.fixtures).resolve()
    _install_stubs(upstream)

    from bench.agents.long_context import LongContextAgent
    from bench.eval.runner import load_jsonl, run_episode
    from bench.eval.scorer import aggregate, score_one
    from bench.llm.types import LLMCallResult

    script = json.loads((fixtures / "script.json").read_text(encoding="utf-8"))["responses"]
    state: dict[str, Any] = {}

    class ScriptedRouter:
        provider = "scripted"

        def complete_result(self, *, system_prompt: str, user_prompt: str) -> Any:
            state["system"] = system_prompt
            state["user"] = user_prompt
            return LLMCallResult(
                text=script[state["checkpoint_id"]],
                provider="scripted",
                model="scripted-1",
                latency_s=0.0,
                usage={},
            )

    rows: list[dict[str, Any]] = []
    scores: list[dict[str, Any]] = []
    for domain_dir in sorted(d for d in fixtures.iterdir() if (d / "episodes.jsonl").exists()):
        episodes = load_jsonl(str(domain_dir / "episodes.jsonl"))
        checkpoints = load_jsonl(str(domain_dir / "checkpoints.jsonl"))
        by_id = {c["checkpoint_id"]: c for c in checkpoints}
        agent = LongContextAgent(max_turns=300, llm_router=ScriptedRouter())
        query = agent.query
        prompts: dict[str, tuple[str, str]] = {}

        def wrapped(ckpt: Any, query: Any = query, prompts: Any = prompts) -> Any:
            state["checkpoint_id"] = ckpt.checkpoint_id
            out = query(ckpt)
            prompts[ckpt.checkpoint_id] = (state["system"], state["user"])
            return out

        agent.query = wrapped  # type: ignore[method-assign]
        for ep in episodes:
            mine = [c for c in checkpoints if c["episode_id"] == ep["episode_id"]]
            turns = ep["turns"]
            position = {t["turn_id"]: i for i, t in enumerate(turns)}
            for pred in run_episode(agent=agent, episode=ep, checkpoints=mine):
                cid = pred["checkpoint_id"]
                ckpt = by_id[cid]
                out = pred["output"]
                score = score_one(checkpoint=ckpt, pred_output=out)
                scores.append(score)
                upto = turns[: position[ckpt["as_of_turn_id"]] + 1]
                dump = {
                    "action": "answer",
                    "answer": "\n".join(t["text"] for t in upto),
                    "answer_structured": {},
                }
                spec = ckpt.get("judge_spec") or {}
                patterns = (
                    (spec.get("include") or [])
                    + (spec.get("not_include") or [])
                    + (ckpt.get("leak_targets") or [])
                )
                literal = {
                    "action": "answer",
                    "answer": "\n".join(patterns),
                    "answer_structured": {"note": "patterns"},
                }
                rows.append(
                    {
                        "checkpoint_id": cid,
                        "system_sha256": _sha(prompts[cid][0]),
                        "user_sha256": _sha(prompts[cid][1]),
                        "output": {
                            k: out[k]
                            for k in (
                                "action",
                                "answer",
                                "answer_structured",
                                "used_record_ids",
                                "context_turns",
                            )
                        },
                        "prompt_memory_block_sha256": _sha(out["prompt_memory_block"]),
                        "score": score,
                        "score_turn_dump": score_one(checkpoint=ckpt, pred_output=dump),
                        "score_patterns": score_one(checkpoint=ckpt, pred_output=literal),
                    }
                )

    golden = {
        "source": "packages/bench/scripts/upstream-golden.py",
        "upstream_commit": "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
        "rows": rows,
        "summary": {k: v for k, v in aggregate(scores).items() if k != "metric_semantics"},
    }
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(golden, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} rows to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
