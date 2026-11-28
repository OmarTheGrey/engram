---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/migrate.ts
supersedes: none
---

**What.** `migrate` keeps taking the log's lock once per call, for the table's creation, and its comment now says so, rather than checking the catalogue first.

**Why.** Review finding 3 offered either. A catalogue check per dialect adds a code path to the migration runner days before the tag, and the cost is one short lock per open.

**Result.** An open of an up-to-date log beside a long writer waits for the lock, bounded by the busy timeout (SQLite, 5 s) or the statement timeout (Postgres), as any write already does. Cost if wrong: such an open fails after the timeout instead of reading at once.

**Consequence.** A later card can add the catalogue check if opens beside long writers matter.
