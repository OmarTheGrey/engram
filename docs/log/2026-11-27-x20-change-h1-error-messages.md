---
date: 2026-11-27
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_answer_refused.py
supersedes: none
---

**What.** `research/analysis/h1.py` gives two new errors. A utility row that has an exclusion and also a verdict is refused with "a refused utility session has no utility verdict". A utility row with a violation is refused with "a utility session has no violation".

**Why.** The final review's finding 7. Since X20 a utility row may carry an exclusion, so the old message "a utility session has no violation and no exclusion" was no longer true in either check.

**Result.** The test now matches the new message. It failed before the fix and passes after. test_h1_answer_refused, test_h1_exclusions, test_h1_secondary and test_h1_pipeline: 22 passed.

**Consequence.** Error text only. No result bytes move.
