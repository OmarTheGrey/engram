---
date: 2026-11-28
author: claude-agent
type: milestone
card: E1.9
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The chain invariant now attests Lee's events through an attesting handle and catches three more tampers: an edited attestation, a deleted one, and one added to an event chained without one.

**Why.** The card's acceptance is the chain invariant on both backends.

**Result.** `make test-invariants`: 3 files, 21 tests passed; chain.test.ts passes on SQLite and on embedded Postgres, every one of the 29 tampers met and caught by the check it names. Tampers that delete events now remove the events' attestation rows first, as the foreign key requires of a tamperer.

**Consequence.** The card's acceptance holds.
