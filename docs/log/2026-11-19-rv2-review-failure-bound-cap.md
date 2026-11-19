---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py -k 'h1_bound or h1_decision' (adjusted = len(HYPOTHESES) * p, no cap): 1 failed, 16 passed"
supersedes: none
---

**What.** Review finding RV2-4: the `min(1.0, ...)` cap on H1's interim bound had no test. With the cap removed, every test still passed.

**Why.** The largest p in the new bound test was 0.15, so 5p stayed below 1.

**Result.** `test_the_h1_bound_is_capped_at_one` checks that p = 0.3 gives `adjusted` 1.0 and "not supported". It passes on the code and fails on the uncapped mutant, as the evidence shows.

**Consequence.** Every term of the bound is now tested: the factor (4p and 6p mutants) and the cap.
