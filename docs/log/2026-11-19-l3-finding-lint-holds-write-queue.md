---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Plane.lint keeps the log's write queue locked while the model answers every unit.

**Why.** Reported by the L3 review. The calls run in the lint's queue slot so the findings describe one projection and nothing is appended if a call fails; a server with a lint model would stall every write for the whole lint.

**Result.** No surface injects a lint model today: the runner lints scratch logs, the server and CLI none.

**Consequence.** Backlogged in docs/tasks/backlog.md: settle it (snapshot, release, then append with a staleness check, or a lint outside the queue) before a server injects a lint model.
