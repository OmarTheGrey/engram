---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/events.ts
  - packages/core/src/plane/adopt.ts
  - packages/adapters/test/plane/rv4-review.test.ts
supersedes: none
---

**What.** A record under an erased id whose record the erasure found nowhere is refused whatever it holds, and deleted, unlike one left in a store that refuses the delete, which adopts once it changes.

**Why.** Card E2.6's rule is that an erased id whose record the erasure deleted is never adopted again; a record not found was not proven left by the person, so the stricter rule applies. `keptInStore` (events.ts) tells the two apart by the clause.

**Result.** In the test, the moved folder's plane-written file under the erased id, edited, is denied and deleted; Claude Code files under new ids adopt once edited, as new content.

**Consequence.** If wrong, a person editing a moved erased file loses that edit to the plane's delete.
