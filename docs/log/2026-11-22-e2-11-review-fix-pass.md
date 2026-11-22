---
date: 2026-11-22
author: claude-agent
type: change
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/policy/retention.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/plane/trust-cross-handle.test.ts
  - packages/core/test/unit/policy/trust.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The review fix pass of card E2.11 closes its eight findings, E2.11-1 to E2.11-8.

**Why.** The review found two important issues and six minor ones, all only with the trust options on.

**Result.** 1: a promotion asks `budgetRefusal` again in its committing transaction. 2: invariant 8 walks promotions and races on two handles. 3: unit tests of the trust module, `evictionShortfall`, `budgetRefusal` and the oracle's readings. 4: the write's and the promotion's commit refusal against a real second handle, on SQLite and embedded Postgres. 5: a held-back sweep records its shortfall (`engram/retention/protected`). 6: the floored guard counts only a claim other than `external`. 7: invariant 8 in `docs/conventions/testing.md`. 8: the `loadPreset` decision.

**Consequence.** The reviewer verifies the invariants file again.
