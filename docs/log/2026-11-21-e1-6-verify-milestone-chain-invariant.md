---
date: 2026-11-21
author: claude-agent
type: milestone
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
  - make test-invariants
supersedes: docs/log/2026-11-21-e1-6-review-milestone-chain-invariant.md
---

**What.** After the verification fixes (E1.6-12, E1.6-13) and the merge of main at 73ae20bd, make test-invariants passes with the chain invariant on SQLite and embedded Postgres: 3 files, 21 tests.

**Why.** The card's acceptance, rerun after the last changes to the verifier and the property.

**Result.** Each backend now runs its own seed; all 26 tampers are met and caught by the check each names. Mutants: 26 of 27 killed; the survivor (an erase event named by two manifests allowed) is equivalent, since the adjacency rule already admits at most one manifest right after an erase event. Gates: api-check, lint and lint-docs pass; core 140, CLI 11 and server 122 tests pass.

**Consequence.** Nothing further on the card.
