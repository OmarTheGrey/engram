---
date: 2026-11-22
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/plane/export.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - docs/dogfood.md
supersedes: none
---

**What.** The twin dogfood's report no longer counts an export among its read events: core's `isExportEvent` tells a Plane.export event (a read naming no item whose reason starts "exported ") from a read.

**Why.** Finding E9.8-9: an export is recorded as a read event but returns no read, so it inflated `reads.events` and `as_declared`.

**Result.** A test exports at the end of the realistic two weeks: `reads.events`, `as_declared` and `items_returned` stay as before (8, 4 and 35), `events` grows by one, no violation. Without the skip it reads 9 for 8. docs/dogfood.md says so in the field table.

**Consequence.** None for the registered conditions: no run exports.
