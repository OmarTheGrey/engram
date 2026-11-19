---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
supersedes: none
---

**What.** Six existing tests that pinned the behaviour this card changes were rewritten to pin the new behaviour; none is an acceptance test of a card still open.

**Why.** They asserted the defects: E2.6's V9 and Q3b expected the stale writer's narrowing to remove a grant adoption reintroduced (adoption now never reintroduces it, and V9 asserts the adoption's own drop); E9.4's I1 expected a hand-typed grant to land; RV3-1 expected the move to fail closed; the dogfood log expected one re-adoption per plane write and `provenance_raised` 2; grants-files expected that re-adoption. `adopt.test.ts`'s ref test moved its holder to another scope.

**Result.** `make test` green with them (counts in the card's PR). A planted raise test keeps the report's raise check covered.

**Consequence.** The invariants file is untouched.
