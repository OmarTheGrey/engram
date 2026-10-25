---
date: 2026-10-25
author: claude-agent
type: change
card: E1.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/migrate.ts
  - packages/core/src/items.ts
  - packages/core/test/unit/items.test.ts
  - docs/decisions/0002-schema-and-generated-contracts.md
  - docs/decisions/0005-bi-temporal-validity.md
  - "pnpm --filter core exec vitest run test/unit/items.test.ts"
supersedes: docs/log/2026-10-25-e1-2-item-store-by-store-ref.md
---

**What.** Reverses the uniqueness of store refs from the card E1.2 entry: several items may now hold one store_ref.

**Why.** Review finding R2-2 on PR #2 and decision D1: a new version is a new item id under the same ref (Adapter.history), a retired item keeps its ref, and the mem0 adapter keys on its own id, so a unique index refused legitimate versions.

**Result.** Migration 2 was edited in place, since PR #2 is unmerged and nothing was persisted: its index is not unique and the projection records the seq of the event that last changed each item. `itemByStoreRef` returns the latest active holder, else the latest holder. The E1.2 test expecting a refusal was replaced by eight tests of the new rule, which failed with a UNIQUE constraint error before the change.

**Consequence.** The superseded entry's consequence no longer holds: a write reusing a ref is not refused.
