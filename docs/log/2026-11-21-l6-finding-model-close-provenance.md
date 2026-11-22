---
date: 2026-11-21
author: claude-agent
type: finding
card: L6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/supersede.test.ts
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** When an agent closes a fact through `memory_supersede`, the item's provenance kind becomes `model`, even when a person wrote the fact.

**Why.** Plane.write sets the provenance from the writer on every rewrite (decision D4); an accepted close is a rewrite.

**Result.** The accept test asserts `provenance.kind` model and `actor` person:dana after the close of a user-written item.

**Consequence.** A trust floor that keys on provenance (card E2.11) would treat the closed fact as model-written. The lead may want a close to keep the item's provenance; that is a core write-path change, out of this card's scope.
