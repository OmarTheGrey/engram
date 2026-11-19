---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-fault-set.json
  - packages/bench/PINS.md
  - "curl -s https://huggingface.co/api/datasets/xiaowu0162/longmemeval-cleaned/tree/98d7416c24c778c2fee6e6f3006e7a073259d48f"
supersedes: none
---

**What.** The cleaned S split at LongMemEval's pinned dataset revision, `longmemeval_s_cleaned.json` at `98d7416`, has sha256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442` and 277,383,467 bytes.

**Why.** H3's fault set needs the S split the pre-registration names (backlog row "LongMemEval split"); PINS.md pins the revision, not the file's hash.

**Result.** The hash of the fetched file equals the LFS object id the Hugging Face tree API lists at that revision (the oracle file's id, `821a2034...`, equals the hash B5's manifest records, so the id is a sha256). It holds 500 questions and 246,750 turns, all parsed by B5's schema (`research/results/h3-fault-set.json`, `questions` and `base.turns`). Its history sessions are not always in date order; B5 writes them in upstream's order, so the log's times are not monotonic, and the generator orders a supersession by time, not by position.

**Consequence.** `research/configs/h3-fault-set.json` checks the file against this hash; B6 can reuse it when it vendors S.
