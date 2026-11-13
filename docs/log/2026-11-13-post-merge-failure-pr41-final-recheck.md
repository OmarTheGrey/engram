---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/events.ts
  - packages/adapters/test/plane/offboard-files.test.ts
  - packages/core/test/unit/erased-content.test.ts
supersedes: none
---

**What.** A final adversarial check of PR #41 found the read of card E2.2 still matched a record re-adopted after an offboarding (card E9.7) by its erased text.

**Why.** Under the lock the read re-read the projection, but kept the store hits and term shares computed on the snapshot, applied by id; a query term only the erased text held still matched the new record, at relevance 1. The erase event's hash list was also found by the first occurrence of its clause, after the store's error text.

**Result.** A hit or share now counts only for an item whose content is unchanged since the snapshot; a changed or new item is matched over its current content. The clause is found by its last occurrence. Two tests added; breaking either fix fails them.

**Consequence.** None beyond PR #41.
