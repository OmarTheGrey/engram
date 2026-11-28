---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** The write refusal uses `lastRemoval`, so a sweep event of either decision refuses the id, and the commit rechecks it for a new item.

**Why.** Adoption's refusal already uses `lastRemoval` of either decision; a sweep whose delete failed leaves a record adoption refuses and purges, so a write there would lose its record too. A failed sweep is no counted change, hence the recheck at the commit.

**Result.** `erasure-gaps.test.ts` covers the allowed sweep; the denied one follows the same function.

**Consequence.** Cost if wrong: an id whose sweep failed can never be used again, as an erased id cannot.
