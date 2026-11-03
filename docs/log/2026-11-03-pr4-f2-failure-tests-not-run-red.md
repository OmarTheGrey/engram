---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_h1_secondary.py
  - research/analysis/h1.py
supersedes: none
---

**What.** The table's tests for MGS, the gate-by-action flag, read-before-acting and the sensitivity guard were written before the code, but not run and seen failing before it was written.

**Why.** The converter's and the audit's tests were run red first; for the table the implementation followed the test file at once.

**Result.** Mutation checks stand in: MGS without its forgetting part, utility sessions in the rates, the flag not checked and the guard removed each fail those tests.

**Consequence.** Run each new test red before writing the code it tests.
