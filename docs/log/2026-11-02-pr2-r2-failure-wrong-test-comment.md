---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** Review finding V6: a round-one test comment said the dense level cases catch a per-side level of 0.05; they did not, the zero-discordance tests did.

**Why.** The comment was written before the mutation was run.

**Result.** The level tests moved to `test_equivalence.py`; each simulated case asserts its measured level is at most 0.05 by two standard errors of 4,000 runs, and a per-side level of 0.05 now fails the first of them (mutation checked).

**Consequence.** None.
