---
date: 2026-11-26
author: claude-agent
type: failure
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_h1_answer_refused.py
supersedes: none
---

**What.** Two first expectations in `test_h1_answer_refused.py` were wrong: the refused utility session was expected to add one to `utility_items`, and a utility row with a violation to fail on the utility check.

**Why.** An item whose only session has a null verdict is no U item, so `utility_items` is unchanged; and parse_session checks "exclusion names why a null violation is excluded" first.

**Result.** Both corrected to what the code is meant to do (out of U as a null verdict is; refused with the earlier message); 2 pass.

**Consequence.** None beyond the corrected test.
