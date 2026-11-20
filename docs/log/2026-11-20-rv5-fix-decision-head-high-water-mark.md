---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read-time.test.ts
supersedes: none
---

**What.** The log's head is the highest ts any event carries, compared as instants with `compareTimestamps`, kept per Db handle as a high-water mark (`logHead`) that reads only events appended since; if the event it last saw is gone (a rolled-back append), it reads the log again.

**Why.** The events table has no ts column and adding one is a schema change (AGENTS.md rule 5); `MAX` over a JSON body differs between SQLite and Postgres and compares strings, not instants. Clamping every event's ts on append would change what writes record and touch events.ts, which RV4 edits.

**Result.** Green on SQLite and Postgres: an earlier write after a late read, a second handle, instants not text, a rollback. Three mutants each turn cases red.

**Consequence.** The first read on a handle parses every event once; later reads parse only new ones.
