---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Removing the tests' scratch folders failed with `EBUSY` on Windows: the SQLite logs were still open.

**Why.** The synthetic logs are files (the script test reads them from disk), and nothing closed them before `rm`.

**Result.** Each log is now closed in `afterAll` before its folder is removed.

**Consequence.** Nothing beyond the fix.
