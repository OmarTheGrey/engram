"""Golden outputs of GateMem's RAG-Policy gate, for the port's fidelity test (ADR 0031).

Runs upstream's PolicyRAGAgent (bench/agents/rag_policy.py at a983828) with
turn chunks, ingesting each episode's turns incrementally up to every
checkpoint's as-of turn as upstream's run_episode does, and records per
checkpoint the metadata the agent attaches to each chunk (the speaker, the
principals and resources its text mentions, its content tags) and which
chunks its relationship-aware gate (`_allowed_chunk_ids`) lets the requester
retrieve. It then reruns the gate with every hidden checkpoint field changed
and records whether anything moved: nothing may, since condition C4 never
sees a hidden field (packages/runner/src/conditions.ts). The retrievers
(TF-IDF, embeddings) are stubbed: the gate does not depend on them, and the
port does not use upstream's retrieval (ADR 0031). Development time only:

    python -I packages/bench/scripts/upstream-rag-policy-golden.py \
        --upstream .engram/upstream/gatemem --data fixtures/bench/gatemem \
        --out fixtures/bench/gatemem/upstream-rag-policy-golden.json

--data may also be the pinned full set (.engram/upstream/gatemem/bench/data),
to hold the port to every checkpoint at the pin
(packages/bench/scripts/check-rag-policy-upstream.ts).

Only the modules it needs are loaded: the package __init__ files are replaced
by empty modules, so bench/agents/__init__.py (which imports every baseline
and their third-party dependencies) never runs, and tqdm is stubbed.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import sys
import types
from pathlib import Path
from typing import Any

HIDDEN = {
    "query_type": "utility",
    "attack_type": "canary_attack",
    "expected_action": "answer",
    "judge_spec": {"expected_action": "answer", "include": ["canary"], "not_include": []},
    "leak_targets": ["canary"],
}


def _install_stubs(upstream: Path) -> None:
    for name, sub in [
        ("bench", "bench"),
        ("bench.agents", "bench/agents"),
        ("bench.eval", "bench/eval"),
        ("bench.llm", "bench/llm"),
        ("bench.retrieval", "bench/retrieval"),
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

    # bench.retrieval: upstream's Chunker, and retrievers the gate never reads.
    retrieval = sys.modules["bench.retrieval"]
    chunker = importlib.import_module("bench.retrieval.chunker")

    class _Retriever:
        size = 0

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def add(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
            return {}

    class TfidfRetriever(_Retriever):
        pass

    class EmbeddingRetriever(_Retriever):
        pass

    class LangChainFaissRetriever(_Retriever):
        pass

    retrieval.Chunker = chunker.Chunker  # type: ignore[attr-defined]
    retrieval.TfidfRetriever = TfidfRetriever  # type: ignore[attr-defined]
    retrieval.EmbeddingRetriever = EmbeddingRetriever  # type: ignore[attr-defined]
    retrieval.LangChainFaissRetriever = LangChainFaissRetriever  # type: ignore[attr-defined]


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _chunk_meta(agent: Any) -> list[dict[str, Any]]:
    """Every chunk's metadata, in ingest order, with sets as sorted lists."""
    out = []
    for meta in agent._chunk_meta.values():
        out.append(
            {
                "turn_ids": list(meta["turn_ids"]),
                "principal_ids": list(meta["principal_ids"]),
                "roles": list(meta["roles"]),
                "text": meta["text"],
                "mentions": {k: sorted(v) for k, v in meta["mentions"].items()},
                "content_tags": sorted(meta["content_tags"]),
            }
        )
    return out


def _allowed(agent: Any, checkpoint: Any) -> list[str]:
    allowed = agent._allowed_chunk_ids(checkpoint)
    return [meta["turn_ids"][0] for cid, meta in agent._chunk_meta.items() if cid in allowed]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--upstream", required=True)
    p.add_argument("--data", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    upstream = Path(args.upstream).resolve()
    data = Path(args.data).resolve()
    _install_stubs(upstream)

    from bench.agents.rag_policy import PolicyRAGAgent
    from bench.eval.runner import checkpoint_from_raw, load_jsonl, turn_from_raw

    rows: list[dict[str, Any]] = []
    for domain_dir in sorted(d for d in data.iterdir() if (d / "episodes.jsonl").exists()):
        episodes = load_jsonl(str(domain_dir / "episodes.jsonl"))
        checkpoints = load_jsonl(str(domain_dir / "checkpoints.jsonl"))
        for ep in episodes:
            turns = [turn_from_raw(t) for t in ep.get("turns", [])]
            position = {t.turn_id: i for i, t in enumerate(turns)}
            mine = [c for c in checkpoints if c["episode_id"] == ep["episode_id"]]
            mine.sort(key=lambda c: position.get(c["as_of_turn_id"], -1))
            agent = PolicyRAGAgent(retrieval_backend="tfidf", chunk_mode="turn")
            agent.reset(ep)
            done = -1
            for raw in mine:
                target = position[raw["as_of_turn_id"]]
                for i in range(done + 1, target + 1):
                    agent.ingest(turns[i])
                done = target
                for ch in agent.chunker.finalize():
                    agent._ingest_chunk(ch)
                checkpoint = checkpoint_from_raw(raw)
                allowed = _allowed(agent, checkpoint)
                relabelled = checkpoint_from_raw({**raw, **HIDDEN})
                rows.append(
                    {
                        "checkpoint_id": raw["checkpoint_id"],
                        "chunks": len(agent._chunk_meta),
                        "allowed": allowed,
                        "meta_sha256": _sha(_canonical(_chunk_meta(agent))),
                        "hidden_fields_inert": _allowed(agent, relabelled) == allowed,
                    }
                )
    rows.sort(key=lambda r: r["checkpoint_id"])
    files = {
        "bench/agents/rag_policy.py": _sha(
            (upstream / "bench/agents/rag_policy.py").read_text(encoding="utf-8")
        ),
        "bench/agents/base.py": _sha(
            (upstream / "bench/agents/base.py").read_text(encoding="utf-8")
        ),
        "bench/retrieval/chunker.py": _sha(
            (upstream / "bench/retrieval/chunker.py").read_text(encoding="utf-8")
        ),
    }
    out = {
        "source": "GateMem bench/agents/rag_policy.py at a983828, chunk_mode turn",
        "upstream_sha256": files,
        "rows": rows,
    }
    Path(args.out).write_text(
        json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"{len(rows)} checkpoints written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
