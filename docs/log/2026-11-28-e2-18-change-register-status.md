---
date: 2026-11-28
author: claude-agent
type: change
card: E2.18
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - research/configs/results-register.json
  - docs/research/results.md
supersedes: none
---

**What.** The results register gains the status `proof of concept`, and the Cedar properties result its section.

**Why.** The lead's request of 2026-11-28 names the status; card E8.16, which might add it, has not merged, so this card adds it with a test.

**Result.** `proof of concept` is one of the register's non-hypothesis statuses, never in HYPOTHESIS_RESULTS; a new test builds a register with it and finds the status line, its count and the unchanged top paragraph.

**Consequence.** Card E8.16, if it adds the same status, keeps one of the two definitions at merge.
