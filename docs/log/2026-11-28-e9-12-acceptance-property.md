---
date: 2026-11-28
author: claude-agent
type: change
card: E9.12
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/consent.test.ts
  - "make test-one T=packages/core/test/property/consent.test.ts"
supersedes: none
---

**What.** The acceptance property: 200 generated opt-out sets and write sequences through the real Plane; no allowed write matches an active opt-out, every consent refusal is one the oracle covers, names its opt-out, carries no item and never repeats the content's nonce; checkWrite agrees; an empty list equals absent (60 runs).

**Why.** The card's acceptance.

**Result.** `make test-one T=packages/core/test/property/consent.test.ts`: 2 passed. Guards (allowed, refused by topic, source, window and everything, carve-out, covered retire and restatement, other scope) all nonzero. Three mutants killed: the deny disabled, carve-outs ignored, `until` inclusive.

**Consequence.** The card's acceptance is met.
