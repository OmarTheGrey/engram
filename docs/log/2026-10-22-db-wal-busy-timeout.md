---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/sqlite.ts
  - packages/core/test/unit/db/migrate.test.ts
supersedes: none
---

**What.** A file-backed event log now runs in WAL mode with a five-second busy timeout, and the outermost transaction begins IMMEDIATE.

**Why.** The final step-0 review found that two processes appending to one log would get "database is locked" at once, because the sequence read ran inside a deferred savepoint with no timeout.

**Result.** Tests show the pragmas are set on a file database, and that two connections appending in turn to one file keep a dense sequence 0 to 3. The 500-sequence replay property still passes.

**Consequence.** Several runner processes can share one log file; nested transactions remain savepoints.
