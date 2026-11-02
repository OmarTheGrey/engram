---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - research/tests/test_research_scripts.py
  - "git show 6e15530"
supersedes: none
---

**What.** The first run of the reworked H4 power script never finished: its rung choice looped forever on cells whose level failed at the first rung with enough power.

**Why.** The inline loop moved up a rung when the level failed, then down again because the rung below had enough power, then up again. My tiny test config never hit a failing level, so the tests passed.

**Result.** `choose_rung` keeps a floor above every rung whose level failed; tests cover the climb past a failed level and fail with an error, not a hang, if the choice loops. The looping run was stopped after about 16 minutes and discarded.

**Consequence.** None beyond the code.
