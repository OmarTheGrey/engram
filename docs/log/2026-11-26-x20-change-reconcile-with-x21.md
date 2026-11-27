---
date: 2026-11-26
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_answer_refused.py
  - packages/runner/test/answer-refusal.test.ts
supersedes: none
---

**What.** After X21 merged (#117), each MGS entry tells one story of the utility sessions out of U: `capped_utility` (X21) for the turn limit, `utility_exclusions` by reason (X20) for any other reason, never one session in both.

**Why.** The coordinator's reconcile: X21's capped rows and X20's refused rows both have a null `utility_ok`.

**Result.** The merge kept both docstring sentences. h1.py now refuses a capped utility row that names an exclusion, and the converter gives a capped row `capped` and no `exclusion`, a refused one an `exclusion` and no `capped` (tested). pytest: answer-refused 3, exclusions, pipeline, secondary and evidence, 37 in all; vitest: h1-sessions 33, answer-refusal 22.

**Consequence.** A table reader adds the two counts to get the utility sessions that left U by a stated reason.
