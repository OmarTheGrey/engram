---
date: 2026-11-02
author: claude-agent
type: milestone
card: X1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/x1-h1-probe.json
  - fixtures/cassettes/x1-h1-gatemem
  - fixtures/cassettes/x1-h1-mem-inv
  - packages/runner/test/x1.test.ts
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/x1-h1-probe.json"
supersedes: none
---

**What.** Card X1's acceptance holds: a re-run of the same config makes zero new model calls, for every condition on both of H1's arms.

**Why.** The card's goal is a condition runner with seeds from the config and caching; plan PR 3 extends it to C1 and C4 on GateMem and MEM-INV-Bench.

**Result.** `make fixtures` recorded 36 calls for `x1-h1-gatemem` (C1 to C5, two checkpoints, seeds 1 and 2) and 48 for `x1-h1-mem-inv` (C2 to C5, two cases, fake, Mem0 and Letta), and changed no other fixture. Run twice offline, the suite printed "44 sessions; model calls in all: 0 new, 84 from cassettes" both times; in-process, a second run on a filled cache makes 0 new calls (`x1.test.ts`).

**Consequence.** Card X1 is done on branch `prereg-pr3-conditions`, awaiting review.
