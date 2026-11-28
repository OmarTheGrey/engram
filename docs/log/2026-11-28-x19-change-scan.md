---
date: 2026-11-28
author: claude-agent
type: change
card: X19
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/residue.ts
  - packages/core/test/unit/residue.test.ts
  - make test-one T=packages/core/test/unit/residue.test.ts
supersedes: none
---

**What.** Core's residue scan: `findResidue(deps, {person, needles, refs})` searches every table of the log's database and every store record under a scope or ref the log names, and labels each hit residue or retained by decision (promoted, outside the person scope, shared store ref, erased-content hash, surviving hash); `scanBytes` finds needles in raw bytes.

**Why.** U7's search per tier, and card E9.14's residue verification, which calls it.

**Result.** Its tests pass on SQLite and Postgres (6 tests): before offboarding nothing is retained but what lives outside the scope; after, the only residue is a read-only store's record. Mutation: dropping the erase-event hash rule fails the after-offboarding test.

**Consequence.** Read-only, no clock, no randomness; no existing module changed.
