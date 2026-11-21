---
date: 2026-11-21
author: claude-agent
type: finding
card: X15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/test/bench/count.test.ts
supersedes: none
---

**What.** The first read time check on a new Db handle reads every event in the log.

**Why.** Card X15's review pass looked for why the probe counted fewer statements on a strict read than on the others.

**Result.** `logHead` in `packages/core/src/plane/read.ts` keeps a high-water mark per Db handle; a handle without one runs `SELECT seq, id, body FROM events WHERE seq > -1` and parses every event's body. A process that opens the log afresh, as each in-process `engram` command does, pays one scan of the whole log at its first plane call; later calls on that handle read only new events. The suite now takes that scan on the probe's handle before counting, and the warm-up takes it on the timed handle.

**Consequence.** A backlog row; the CLI's latency grows with the log even for one call.
