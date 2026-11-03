---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-c4-verdict-agreement.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** Recommended, for the lead's decision: C4's verdict on GateMem is the plane's own read decision, `c4_verdicts: "engram"` (decision sheet item 3).

**Why.** C4 minus C5 should measure being told against being enforced under one policy.

**Result.** GateMem's RAG-Policy gate and the plane agree on 235,384 of 325,530 turn items (0.7231); the gate allows what the plane denies on 60,305 (0.1853); the counts are identical under the three presets (`research/results/h1-c4-verdict-agreement.json`).

**Consequence.** If changed, `c4_verdicts` in `research/configs/h1-gatemem.json` and C4's cache keys.
