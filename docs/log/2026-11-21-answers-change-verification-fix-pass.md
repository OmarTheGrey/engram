---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/tasks/lead-decisions.md
  - docs/tasks/backlog.md
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
  - docs/research/label-audit.md
supersedes: docs/log/2026-11-21-answers-change-review-fix-pass.md
---

**What.** The answers card's verification fix pass: V-1 to V-8, on main after E1.4, R4, A5 and B10.

**Why.** The verification found one critical, three important and five minor problems.

**Result.** Before: a cap checked in ledger dollars, the lead's rows mixing his words with additions, a new judge-id requirement, rejected items excluded below the stop, "reasoning tokens metered", H3's fallback only in its Analysis, a header silent on the lead's answers. After: the cap in billed dollars with the conversion, the credit check and the overshoot; 401, 402 and 403 stop a run; the lead's words apart; the judge as registered, a limitation; items kept below the stop; tokens counted inside output; the fallback in H3's Test; the lead's answers in the header and Status; the check runs' fixed ceilings. Four backlog rows changed, two added.

**Consequence.** Card R2 may start.
