---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/db/migrate-race.test.ts
supersedes: none
---

**What.** The two-process race did not fail on SQLite before the fix, at two and at four racers, with staggered delays up to 15 ms.

**Why.** SQLite's busy handler sleeps, so the racer that loses the first lock usually wakes after the winner applied every migration.

**Result.** Postgres failed every time. A deterministic interleave (a handle that lets the other one migrate right after its first read of the table) was added; it fails on both backends before the fix.

**Consequence.** The process test stays as a regression on both backends; the deterministic case is the one that proves the SQLite window.
