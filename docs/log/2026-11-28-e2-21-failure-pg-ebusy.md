---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.21
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - make test-one T=packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** `make test-one` on `dogfood-report.test.ts` exited 2 after all 51 tests passed.

**Why.** Logged as the lead asks.

**Result.** The exit came from the embedded Postgres teardown: "error during close [Error: EBUSY: resource busy or locked, rmdir '...\\engram-pg-...\\data']", Windows holding the temporary data folder while other agents load the machine. A first run in the background never printed its counts. No assertion failed.

**Consequence.** None for the change; the orchestrator's serial run should not see it.
