---
date: 2026-11-19
author: claude-agent
type: change
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py -k 'h1_decision or h1_bound': 16 passed; with the 4p mutant 7 failed, 9 passed"
supersedes: none
---

**What.** `test_the_h1_decision_by_hand` gains p = 0.011 with no other p-values, which must read "undecided", and a new parametrised test asserts that the bound's `adjusted` is min(1, 5p) for six p-values.

**Why.** RV-EXP-6: the cases before could not tell 4p from 5p. At p = 0.011, 4p = 0.044 is below 0.05 and 5p = 0.055 is not.

**Result.** All 16 cases pass on the code. With `adjusted = min(1.0, 4 * p)`, 7 fail: the p = 0.011 read-out and all six `adjusted` assertions. The code is unchanged.

**Consequence.** A wrong factor in H1's interim bound now fails `make test`.
