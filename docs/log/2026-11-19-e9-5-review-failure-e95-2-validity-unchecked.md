---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-2 (critical): a read outside an item's validity window was not a violation.

**Why.** The oracle's `readable` checks access and the ttl, not `valid_from <= at < valid_to`, which the evaluator refuses (`engram/read/validity`).

**Result.** A new oracle function, `withinValidity`, judges every returned item beside `readable`, which is unchanged. Tests plant a read after `valid_to`, one before `valid_from` and one past the ttl, each `read` 1; dropping the check fails two of them.

**Consequence.** Invariant 1 still uses `readable` alone; whether it should also check validity is the lead's.
