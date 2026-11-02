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

**What.** The mutation check of the rung choice's floor hung instead of failing.

**Why.** One of the two rung-choice tests guarded against a loop and the other did not; with the floor removed, the unguarded case (a level that never holds) looped forever, so the mutant was neither killed nor survived until I stopped its test processes by id.

**Result.** That case now counts its calls and raises after 50; rerun, the mutant is killed by both tests in under a second, and `power.py` was restored byte for byte.

**Consequence.** A test of a search loop guards against looping in every case.
