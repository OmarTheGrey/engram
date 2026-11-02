---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_research_scripts.py
  - research/analysis/power.py
supersedes: none
---

**What.** The first version of the round-two power tests took over three minutes, and one asserted that the rung below a reported size lacks power, which fails when the level gate set the size.

**Why.** The tiny config ran 4,000 level runs at both alphas for every checked size, and the exact level enumerated count pairs in a Python double loop.

**Result.** The tiny config tests alpha 0.01 in one cell only, the exact level enumerates the two counts as one array, and the assertion accepts a rung below that failed the level instead. The research tests run in about 30 seconds.

**Consequence.** None.
