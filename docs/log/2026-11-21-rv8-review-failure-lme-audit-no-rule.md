---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/label-audit-longmemeval.json
  - docs/log/2026-11-20-rv8-finding-lme-audit-rule.md
supersedes: none
---

**What.** The pre-registration registers no sampling rule for LongMemEval's audit, and the uniform draw of 50 holds few unanswerable questions (review finding RV8-5).

**Why.** A uniform draw from 500 with 30 abstention questions expects 3, and the draw of seed 20261103 holds fewer, so the answerability label is checked on a handful of items.

**Result.** The audit's stop (6 of 50 rejected) cannot speak to the abstention class. No code was changed.

**Consequence.** See the finding on stratified allocation and the backlog row for the lead.
