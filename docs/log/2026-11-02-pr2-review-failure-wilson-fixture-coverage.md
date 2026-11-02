---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Adding an item effect to the H1 fixture made a test fail that asserted C5's Wilson interval contains the planted 5 percent.

**Why.** That assertion was a coverage statement for one seeded draw, which fails about one time in twenty; with the new draws the interval was 0.0513 to above, just missing 0.05.

**Result.** The test now asserts the interval contains the observed rate and equals Wilson's with the item count as n, which is what it means to check.

**Consequence.** None.
