---
date: 2026-11-28
author: claude-orchestrator
type: failure
card: D4
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - "make test-one T=packages/core/test/unit/dogfood-report.test.ts"
supersedes: none
---

**What.** Main was red after card D4 (#151): `dogfood-report.test.ts` requires every `engram/` rule id core names to be on the dogfood report's list, and D4's six `engram/drift/*` refusals were missing. They are added.

**Why.** The orchestrator's verification of D4 ran the drift and ADR-index tests and the invariants, not the dogfood report's tests; card E2.19's agent found it.

**Result.** The test passes, 48 of 48. The report's format is unchanged: the list only names rules the report may meet.

**Consequence.** Before each merge the orchestrator runs the core unit suite, not only the card's own files.
