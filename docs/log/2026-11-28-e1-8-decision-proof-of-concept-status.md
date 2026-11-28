---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - research/configs/results-register.json
supersedes: none
---

**What.** The results register gains the status `proof of concept`, with its test.

**Why.** The addendum asks proof-of-concept rows to carry that status; the register had none.

**Result.** It decides no hypothesis (not in HYPOTHESIS_RESULTS); the trace replay row is its first.

**Consequence.** Other cards of the second plan may add the same status; the orchestrator keeps one definition at merge.
