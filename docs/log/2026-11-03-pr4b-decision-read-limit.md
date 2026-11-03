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
  - docs/log/2026-11-02-x1r3-floor-recall.md
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** Recommended, for the lead's decision: the read limit stays 20, GateMem's RAG-Policy `top_k` at its pin (decision sheet item 5).

**Why.** One limit for C2, C3, C5 and MEM-INV-Bench's C4, taken from the benchmark rather than chosen by the experimenter.

**Result.** C2's top 20 holds the leak target or the answer on 2,109 of the 2,207 full-set checkpoints whose history holds one (`docs/log/2026-11-02-x1r3-floor-recall.md`).

**Consequence.** If changed, `read_limit` in both H1 configs and v1's shared-retrieval paragraph.
