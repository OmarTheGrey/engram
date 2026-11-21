---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
supersedes: none
---

**What.** `test_run_limits.py` matched each ceiling as a bare substring of v1, with a tolerance of half a cent (review finding ANS-9).

**Why.** It was written to catch a missing number, not a misplaced one.

**Result.** Each figure is now matched on its run's own line, to the cent.

**Consequence.** A test ties a number to what it names.
