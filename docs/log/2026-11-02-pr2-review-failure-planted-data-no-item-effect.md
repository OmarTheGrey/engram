---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_analysis.py
  - research/analysis/h1.py
supersedes: none
---

**What.** Review finding P2-4: the planted null and the H1 table fixture had no item effect, so pairing sessions instead of seed-averaged items passed every test (mutation M1).

**Why.** Without an item effect a session behaves like an item, and treating sessions as units costs nothing; real models answer an item alike across seeds.

**Result.** Planted items now draw a propensity per condition (Beta, a + b = 2). Over 600 runs of a planted null through the H1 table, items as units reject at 0.043 and sessions as units at 0.102; the test requires at most 0.07 and that the primary contrast's n equals the item count. M1 is now killed by four tests.

**Consequence.** None beyond the tests.
