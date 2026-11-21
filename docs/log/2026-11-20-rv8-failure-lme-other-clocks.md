---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/scripts/frontier_axes.py
  - research/tests/test_frontier_axes.py
supersedes: none
---

**What.** The first full frontier run (76 minutes) compared each LongMemEval variant with the baseline over all three clocks, not only B5's read time.

**Why.** `questions_changed` and `identical_to_baseline` compared whole per-preset cells, which hold the last-session and real-time reads too; ttl-none then changed 500 questions although it hides nothing at read time.

**Result.** Both now compare the write decisions and the read at the configured clock only; a test with a variant that differs only at another clock fails on the old code and passes on the new. The result was regenerated from scratch.

**Consequence.** The committed result is the second run's; the first was deleted unread into any document.
