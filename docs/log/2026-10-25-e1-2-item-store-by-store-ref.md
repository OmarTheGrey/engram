---
date: 2026-10-25
author: claude-agent
type: change
card: E1.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/items.ts
  - packages/core/src/db/migrate.ts
  - packages/core/test/unit/items.test.ts
  - "pnpm --filter core test"
supersedes: none
---

**What.** Card E1.2 added the item metadata store in `packages/core/src/items.ts`: lookup by id and by store_ref, and a lineage walk returning an item's ancestors nearest first.

**Why.** The plane owns item metadata while the store owns the bytes (ADR 0013), so the plane must resolve a store_ref to its item, and lint and explain need an item's superseded versions.

**Result.** Migration 2 adds `store_adapter` and `store_key` columns to the items projection, backfills them from the item body and makes the pair unique; migration 1 is untouched. The walk is breadth first, so a version naming only its parent still reaches the root; it ends on cycles and reports ancestors absent from the projection in `missing`. `items.test.ts`: 15 tests pass. Removing the unique index or the recursive step fails a test.

**Consequence.** A write reusing another item's store_ref is refused before its event lands.
