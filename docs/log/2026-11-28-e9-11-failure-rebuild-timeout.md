---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/replay/rebuild.test.ts
  - pnpm exec vitest run --project @engram/core
supersedes: none
---

**What.** The core project run after the review fixes failed one test: the Postgres property "rebuild equals incremental for any event sequence".

**Why.** It hit the shared 30 s timeout on a loaded machine. The property never touches `data_keys` or the key functions.

**Result.** "Tests 1 failed | 3755 passed | 1 skipped (3757)", the failure "Test timed out in 30000ms". The file passed when rerun alone: "Tests 2 passed (2)". So the failure was load.

**Consequence.** None for the card. The orchestrator's serial run settles it.
