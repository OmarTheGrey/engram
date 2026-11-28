---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** A lint detects a fault when the lint that checks the field the operator corrupts raises a finding the clean state lacks: on the target for supersession (expired-validity) and missing metadata (missing-provenance), and, for deletion, an orphan on any item whose evidence names the deleted id, since no finding can name an item no longer projected. Other new findings are counted apart.

**Why.** The first fixture run counted any new finding on the target, but a restored closed version becomes readable and raises its natural missing-provenance finding, which says nothing of the fault.

**Result.** `packages/bench/test/governance-faults/detect.test.ts` shows a deletion detected through the item naming it. On B5's states no item names another by id, and both supersession faults reopen the window, so those zeros hold by construction.

**Consequence.** If wrong, a lint catching a fault through another field is undercounted.
