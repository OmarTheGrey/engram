---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Until H2 to H5 have primary p-values, H1's Holm decision uses the bound 5p: supported if 5p is below 0.05, not supported if p is at or above 0.05, undecided between.

**Why.** Holm adjusts the five primary p-values together, but Gate C reads H1 alone. Holm's adjusted value for H1 lies between p and 5p whatever the other four are, so the bound decides exactly the cases that do not depend on them.

**Result.** `decide_h1` reports the method (`bound` or `holm`), the adjusted value and the decision; with all five p-values it applies Holm. Nine hand cases in `test_analysis.py`. Cost if wrong: none for a decided case; an undecided H1 waits for the other hypotheses.

**Consequence.** The Gate C read-out can be "undecided"; PR 4 says so in v1.
