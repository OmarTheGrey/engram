---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read-time.test.ts
  - packages/server/test/rv5.test.ts
  - docs/decisions/0005-bi-temporal-validity.md
supersedes: none
---

**What.** Core judges a read's access (status, ttl, grants), and stamps its ts, never earlier than the log's last event (`accessTime`); an earlier named time becomes the read's history `valid_at`, recorded apart from ts. The timeline route uses the same time (finding RV-CORE-3, at the coordinator's request).

**Why.** The server fix held only on the server: a Plane caller, or a server clock running behind the log, could still name an earlier time and reopen an expired grant, with the log's timestamps running backwards.

**Result.** The review's repro: Sam's grant expires 2026-12-19; a read at 2027-01-10 returns 0, and a read named 2026-11-19 appended after it now returns 0 too, with ts 2027-01-10 and its named time in the reason. With the clamp removed the test fails; the `/events` test likewise.

**Consequence.** ADR 0005 and 0027 carry proposed amendments for the lead.
