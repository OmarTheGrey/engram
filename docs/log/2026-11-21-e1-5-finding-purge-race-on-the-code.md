---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/before-read.ts
  - packages/core/src/plane/write.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-e1-5-finding-purge-after-swept-id.md
---

**What.** For the lead, review finding E1.5-8: the swept-id purge race is real in the code, and a committed write is lost at the next adoption.

**Why.** The review reproduced `good::sweptIdPurgeRaceTest` on two SQLite handles of one log: adoption refuses a record under a swept id, a write under that id commits, the purge deletes its record, and the next adoption retires the item.

**Result.** Reachable wherever adoption runs beside a writer in another process: `before-read.ts` `syncBeforeRead` adopts on the owner's read (`engram read`, the pi extension before each prompt) while `engram serve` writes. A second path: the purge retry for bytes already refused (adopt.ts, the `decided` branch) deletes with no lock and no deferral.

**Consequence.** A core card should refuse new writes under swept ids, or check under the lock before each purge's delete; a backlog row names both.
