---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - make test-one T=packages/core/test/unit/audit/report.test.ts
supersedes: none
---

**What.** The first run of the report test failed one of 26: the statement's oracle gave one read violation where the test expected none.

**Why.** The test assumed the oracle knew dana's team membership; it judges an undeclared reader by its own scope (see the finding of the same date).

**Result.** "expected { violations: { read: 1, ... } } to deeply equal { violations: { read: +0, ... } }". The test now states the count of 1 with its note, and a second test declares dana and gets 0.

**Consequence.** Core's statement takes declared actors and records how many.
