---
date: 2026-10-25
author: claude-agent
type: finding
card: B1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/upstream-full-scores.py
  - packages/bench/scripts/check-gatemem-upstream.ts
  - "node packages/bench/scripts/check-gatemem-upstream.ts <upstream dir> <scores.json>"
  - fixtures/bench/gatemem/README.md
supersedes: none
---

**What.** The port's loader and rule-based scorer were checked against GateMem's own Python code on the whole dataset at a983828, not only the 20 fixture checkpoints.

**Why.** JavaScript and Python regular expressions differ at the edges, and a strict loader only proves itself on all the data.

**Result.** The strict loader parsed all 91 episodes and 2,218 checkpoints. On two synthetic answers per checkpoint (the turns up to it and the whole episode), the port's `scoreOne` agreed with upstream's `score_one` on every field of all 4,436 scores: 0 mismatches (`check-gatemem-upstream.ts` output). The data holds five hidden fields plus `judge_spec.attack_type` on 23 office checkpoints; no turn has `record_refs` or `memory_ops`.

**Consequence.** Rule-based scores from the port can stand in for upstream's auxiliary scorer.
