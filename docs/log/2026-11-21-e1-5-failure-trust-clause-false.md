---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - specs/commit.qnt
supersedes: none
---

**What.** Review finding E1.5-2: property 4's first clause, "every adoption records a kind no more trusted than import", is false for the code, and the model hid it.

**Why.** `write.ts` `adoptedItem` keeps the plane's provenance when a record's content and provenance are as the plane holds them (`asHeld`); the reviewer adopted a record whose confidence alone was edited as `user`. The model's records had no field besides content and kind, so `asHeld` could not arise.

**Result.** With `meta` on store records and `asHeld` modelled, the old clause is refuted by simulation and by `asHeldKeepsTrustTest` (mutant m9); the clause is now invariant 6's: no more trusted than the claim and the plane's kind, and no more than import unless as held.

**Consequence.** A property must be checked against the code's own exceptions, not a paraphrase of them.
