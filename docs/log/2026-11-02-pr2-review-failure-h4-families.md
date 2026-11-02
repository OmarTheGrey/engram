---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/research/preregistration.md
  - research/scripts/h4_power.py
supersedes: none
---

**What.** Review finding P2-6: the H4 power finding read one family's power as H4's, though H4 needs every pair to pass across stores and across models, on two benchmarks.

**Why.** The pre-registration's H4 is supported only if every pairwise equivalence holds, and it names GateMem and MemoryAgentBench; four families of three arms, each needing all its pairs, make joint power lower than any one family's.

**Result.** `h4_power.py` now reports, per cell, the items for a per-family power of 0.8, 0.8^(1/2) and 0.8^(1/4) (one, two and four families jointly at 0.8), and states that the store and model tables coincide under the generative model.

**Consequence.** The H4 finding is superseded.
