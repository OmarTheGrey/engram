---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/tau2_engram.py
supersedes: none
---

**What.** The first probe of the judge's route made no judge call. It ran retail task 5, picked as the first test task with NL_ASSERTION in its reward basis.

**Why.** tau2's NLAssertionsEvaluator returns reward 1 without calling its judge when a task lists no assertions. Task 5's basis names NL_ASSERTION, but its `nl_assertions` list is empty.

**Result.** The probe moved to task 36, which has assertions. It recorded one judge call through the third proxy and replayed it offline. Counting showed that 40 of the 112 NL-basis retail tasks have assertions.

**Consequence.** The judge finding states the count.
