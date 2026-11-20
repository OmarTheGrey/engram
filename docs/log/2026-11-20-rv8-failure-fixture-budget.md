---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/tests/test_frontier_axes.py
supersedes: none
---

**What.** The fixture test of the frontier entry failed on its budget assertion: budget-25 evicted nothing on LongMemEval's committed fixture.

**Why.** The fixture is the oracle subset, whose histories hold the evidence sessions only, under 25 turns a question.

**Result.** The test uses its own budget-2 variant; the configured budgets (25 to 400) are measured on the S split, where a history holds about 493 turns.

**Consequence.** None.
