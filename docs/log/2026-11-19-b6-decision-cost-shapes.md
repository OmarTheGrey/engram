---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/research/cost-shapes.ts
  - research/configs/h2-longmemeval-cost.json
supersedes: none
---

**What.** The cost table's memory per read uses the question's own text as the query, and C5's list is core's evaluateRead then the shared pipeline, not a plane per question; the candidates are H1's.

**Why.** H1's table did the same on GateMem; a plane per S question costs about 2.4 seconds, the evaluateRead path a fraction of that; decision sheet item 1 is open, so the candidate list stays H1's.

**Result.** A test holds the evaluateRead list equal to C5's plane read (Plane.write, then the core pipeline at limit 20) on the 20 fixture questions, and a synthetic one shows it leaves out ttl-hidden turns. `candidates_from` reads `research/configs/h1-cost.json`.

**Consequence.** A live model writes its own query; the assumption is in the result.
