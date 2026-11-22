---
date: 2026-11-22
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/oracle.test.ts
  - fixtures/distill/d3-validate/tasks.json
  - docs/decisions/0046-replay-validation-source.md
supersedes: none
---

**What.** Card D3's verification fixes: D3-13 fixes the seeds at 1, 2 and 3 in core, the oracle, invariant 2 and the runner config; D3-17 pins `replayAdmits` on fixed cases; D3-14 pins ties as passes; D3-15 corrects stale text.

**Why.** Findings of the verification pass after the lead's answers.

**Result.** The stale text: the task pool's comment on `bump-timeout-06`, ADR 0045's first consequence (the old reason), point 8 (the draw stays the caller's) and its cherry-picking consequence. Three log entries are superseded. The acceptance is unchanged: "model calls: 0 new, 334 from cassettes".

**Consequence.** Nothing in the fixture's cassettes moved.
