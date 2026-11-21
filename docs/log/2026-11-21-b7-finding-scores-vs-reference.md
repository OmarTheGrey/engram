---
date: 2026-11-21
author: claude-agent
type: finding
card: B7
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/summary.ts
  - "make bench BENCH=merit"
supersedes: none
---

**What.** The slice against MERIT's own reference run `runs/phasec/mini3-d1-easy` (gpt-4.1-mini).

**Why.** Step 5 of the card.

**Result.** Every cell's 10 episodes have the reference's task id, kind and dependence (`episodes_mismatched: []`). C1: scripted 10/10, dependent 4/4; the reference's C1 on the same episodes 10/10, 4/4. Not comparable: one model is scripted. C2 and C5 have no MERIT counterpart; both 8/10, dependent 2/4, with the fact in memory 4/4: both address probes miss, since a 600-character chunk splits the plant's line and the agent takes the last address in rank order.

**Consequence.** The worlds replay as upstream; success is a pipeline check only.
