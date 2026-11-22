---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** Under `protect_trusted`, adopting a hand-edited record of a more trusted item is denied (`engram/write/downgrade`), and the plane keeps the version it approved.

**Why.** Adoption runs as the store's owner with source `import`, and ADR 0040's exemption covers only the owner acting as `user`; the edit may come from anything with file access.

**Result.** The deny is recorded once per store content (adoption skips a denied hash); adoption no longer retracts a more trusted item because its edit was denied, as for review finding I-3; the owner applies the edit through the plane as user. Retracting a record the store no longer lists is unchanged: the plane does not serve memory no store holds. Invariant 8 judges the first retraction and not the second.

**Consequence.** If wrong, hand edits wait until made through `engram write`: friction, never a lost item.
