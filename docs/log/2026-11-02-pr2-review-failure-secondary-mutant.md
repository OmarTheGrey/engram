---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Review finding P2-5: reading the poisoning arm's lower interval end instead of its upper end (mutation M4) survived every test.

**Why.** No H1 table test had a poisoning arm whose interval straddles zero, the only case where the two ends decide differently.

**Result.** Two table tests were added: an arm with C5 planted worse ("contradicts", H1 not supported) and one whose interval straddles zero ("does not contradict"). M4 is now killed.

**Consequence.** None beyond the tests.
