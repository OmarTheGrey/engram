---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/overlap.ts
  - research/results/h1-redteam.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** The overlap table with MEM-INV-Bench maps each route and source kind of the red-team suite to the laundering channels it shares, not each AMSB family, as proposal P1 worded it.

**Why.** Every AMSB family enters by every route and kind, so a family's channels would be the same union for all five families and say nothing. What the two arms share is a write path: the provenance kind and scope level the plane decides on. MEM-INV-Bench's poison is a false fact driving an action, and no AMSB family plants that: a mapping by content would be a judgement. The kind mapping is computed from the vendored cases with no hidden label.

**Result.** Document shares direct and corroborate (16 cases), tool shares tool_echo (8), model shares summarize (8); the other cells share none (review finding X14-5).

**Consequence.** The registration of P1 should word the overlap by write path.
