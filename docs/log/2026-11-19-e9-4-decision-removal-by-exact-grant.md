---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/grants.ts
  - packages/core/test/unit/policy/grants.test.ts
supersedes: none
---

**What.** A grant change names grants to add and grants to remove, each removal as the item carries it (every field equal, the expiry compared as an instant), rather than replacing the list or naming a position.

**Why.** Two editors open on one item would each overwrite the other's change with a replaced list, and a position shifts when another change lands first; a change judged in the write queue against the grants the item holds now does neither. A removal naming no grant on the item, or an addition already on it, is refused (`engram/grant/unchanged`), so every allowed event changes something.

**Result.** `sameGrant` treats `2026-12-01T00:00:00Z` and `2026-12-01T00:00:00.000Z` as one expiry (`packages/core/test/unit/policy/grants.test.ts`).

**Consequence.** Changing a grant's expiry is a removal and an addition in one call.
