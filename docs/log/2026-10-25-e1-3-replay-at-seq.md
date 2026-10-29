---
date: 2026-10-25
author: claude-agent
type: change
card: E1.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/replay.ts
  - packages/core/src/events.ts
  - packages/core/test/replay/items-at.test.ts
  - "pnpm --filter core test"
supersedes: none
---

**What.** Card E1.3 added `itemsAt(db, seq)`, which rebuilds the item set as it stood after any seq from the event log alone, without reading the items table.

**Why.** ADR 0003 makes the log the source of truth; the simulator (card E8.9) and explain need the state at a past point.

**Result.** The projection rule became one pure function, `applyEvent`, used by both the stored projection and replay. On a 13-event fixture workload covering every op, and over 300 seeded random sequences (seed from the test name), `itemsAt` equals the live projection observed after every append, also with the items table emptied. Changing the bound from `<=` to `<` fails all four replay tests.

**Consequence.** `itemsAt` folds from seq 0 on every call; snapshots are left until a workload is large enough to need them.
