---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** Review finding R2-3: the round-two test of the TOST p-value's scale in Holm could not catch a p-value on the one-sided scale.

**Why.** Its sample's p was far below Holm's threshold either way, so halving p changed no decision; and the `decide_h1` half compared Holm's adjusted value with Holm's own output, not a hand value.

**Result.** A new test uses 114 items with no disagreement at a 5-point margin: z = sqrt 6 on both sides and p = 0.0143. As the smallest of five, H4 meets Holm's threshold 0.01: not rejected, as the TOST at 0.01 refuses, and H1's adjusted value through `decide_h1` is 0.0715 by hand. The one-sided mutant (p 0.0072) fails it.

**Consequence.** None.
