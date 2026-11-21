---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/helpers/failpoint.ts
  - packages/core/test/unit/plane/crash-windows.test.ts
  - docs/absorbed.md
  - "make test-one T=packages/core/test/unit/plane/crash-windows.test.ts"
supersedes: none
---

**What.** A test-side failpoint helper, ported from EverOS (`src/everos/core/failpoints.py` at commit e5778edb4cbac71e359ea375f38cf805aae32b0c, Apache-2.0, licence read at that commit), wraps one handle's Db and store and crashes, raises, pauses or skips at a named step.

**Why.** Card E1.4 needs each window between a store write and its event append to be a deterministic test, without touching core's source.

**Result.** Points `store.write|delete|list|read:before|after` and `commit:before|after` (a commit point sees the events its transaction appended). `crash` kills the handle: every later Db and store call through it throws, so no catch block records anything. EverOS's four mode tests are ported as the first block of crash-windows.test.ts; 51 of 51 pass on SQLite and embedded Postgres. One row in `docs/absorbed.md` (mode port); a port needs no NOTICE entry.

**Consequence.** Crash windows are named by what the commit records, not by call counts.
