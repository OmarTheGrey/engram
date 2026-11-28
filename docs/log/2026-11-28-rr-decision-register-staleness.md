---
date: 2026-11-28
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - docs/conventions/documentation.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The results register reads only measurement entries from `docs/log`, generates its top paragraph from the statuses, and states what the first hypothesis-result PR must do.

**Why.** Its review found that any entry citing a results file made the register stale, so an unrelated decision would fail `pytest research`; and that H1's table PR would be refused with nothing telling card X4 why.

**Result.** The count of other citing entries is gone; a test shows a finding, decision or change entry citing a results file leaves the register current, and another that a measurement entry changes it. A `HYPOTHESIS_RESULTS` set, empty now, drives the "No hypothesis has a result yet" paragraph. The three steps are in the script's docstring, rule 3 of the convention, the AGENTS.md line, the log-entry prompts and a backlog row for card X4.

**Consequence.** Only measurement entries and MANIFEST changes need a rebuild.
