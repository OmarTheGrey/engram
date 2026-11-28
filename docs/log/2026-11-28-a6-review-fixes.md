---
date: 2026-11-28
author: claude-agent
type: change
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
  - packages/adapters/src/lock.ts
  - packages/adapters/test/mcp-memory/review.test.ts
supersedes: none
---

**What.** Card A6's review fixes: a delete strips only the `engram` member from a line that holds other clients' observations or fields; lines are kept as bytes (invalid UTF-8, a missing final newline); a broken Engram entity still blocks its id, and a renamed copy no longer blocks the item it names; the shared lock reads the server's `{pid, hostname}` record as a holder and writes `hostname` too.

**Why.** Review findings 2, 3, 6 and 7, and the orchestrator's decisions of 2026-11-28.

**Result.** `review.test.ts` passes 12 tests. Mutations each fail tests: deleting the whole line (2), no sweep (1), no dead-pid check for the server's lock (1), no `hostname` in Engram's record (1). Conformance still passes 291, skips 41.

**Consequence.** The lock-break race (#5560 upstream) is a backlog row; a server that crashed on this machine no longer blocks Engram for 30 s.
