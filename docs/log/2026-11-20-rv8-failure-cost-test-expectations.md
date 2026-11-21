---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_cost_table.py
  - research/scripts/cost_table.py
supersedes: none
---

**What.** Two cost-table tests failed on the first run: H1's high output tokens on MEM-INV-Bench were 800 above h1-cost's, and the item 2 test expected H2 to repay all of H1's utility saving.

**Why.** The first: h1_cost.py prices the agent note's 300-token limit unscaled, and the table scaled it by 4/3 (8 notes, 100 tokens each). The second was the test's error: H2 shares only C2 and C5, not C3 and C4.

**Result.** The note's limit is now unscaled as in h1_cost.py, and the test compares H2's new cost with H1's C2 and C5 utility cells. Both pass.

**Consequence.** None beyond the fix.
