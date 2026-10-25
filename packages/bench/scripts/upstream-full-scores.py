"""Upstream rule-based scores on the full GateMem dataset, for a one-off port check (card B1).

For every one of the 2,218 checkpoints at a983828, scores two synthetic
answers with upstream's own score_one: the text of every turn up to the
checkpoint, and the text of the whole episode. The port is then compared with
packages/bench/scripts/check-gatemem-upstream.ts. Development time only; the
output is not committed (it is about 60 MB):

    python -I packages/bench/scripts/upstream-full-scores.py <upstream dir> <out.json>
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path


def main() -> int:
    upstream = Path(sys.argv[1]).resolve()
    for name, sub in [("bench", "bench"), ("bench.eval", "bench/eval")]:
        mod = types.ModuleType(name)
        mod.__path__ = [str(upstream / sub)]
        sys.modules[name] = mod
    sys.path.insert(0, str(upstream))
    from bench.eval.scorer import score_one

    out = {}
    for domain in ["education", "household", "medical", "office"]:
        data = upstream / "bench" / "data" / domain
        with open(data / "episodes.jsonl", encoding="utf-8") as f:
            episodes = {e["episode_id"]: e for e in map(json.loads, filter(str.strip, f))}
        with open(data / "checkpoints.jsonl", encoding="utf-8") as f:
            checkpoints = [json.loads(line) for line in f if line.strip()]
        for c in checkpoints:
            turns = episodes[c["episode_id"]]["turns"]
            pos = [t["turn_id"] for t in turns].index(c["as_of_turn_id"])

            def text(ts: list[dict[str, str]]) -> dict[str, object]:
                return {
                    "action": "answer",
                    "answer": "\n".join(t["text"] for t in ts),
                    "answer_structured": {},
                }

            out[c["checkpoint_id"]] = [
                score_one(checkpoint=c, pred_output=text(turns[: pos + 1])),
                score_one(checkpoint=c, pred_output=text(turns)),
            ]
    with open(sys.argv[2], "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f)
    print(f"scored {len(out)} checkpoints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
