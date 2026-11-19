---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_holm.py
supersedes: none
---

**What.** Found in the review of PR #57: `decide_h1` read a NaN upper end of MEM-INV-Bench's interval as "does not contradict". The behaviour predates card X4.

**Why.** `secondary_high < 0.0` is false for NaN, so the check fell through to the branch that does not contradict H1; an infinity was taken as a number too.

**Result.** `decide_h1` refuses a secondary bound that is not finite; three parametrised tests (NaN, inf, -inf) failed before the guard and pass after. Three lines in `research/analysis/h1.py`.

**Consequence.** A broken poisoning-arm interval now stops the table instead of supporting H1.
