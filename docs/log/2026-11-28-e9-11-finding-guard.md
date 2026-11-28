---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.11
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - packages/core/src/db/migrate.ts
supersedes: none
---

**What.** Which registered rows and fixtures the change can reach.

**Why.** The guard: no registered byte may move.

**Result.** None. The change adds an empty table to every new or migrated log and exports new functions; no event, item, explanation, policy or preset changes, and no committed SQLite file exists in the repository (`git ls-files` finds none). Results hash event and result files, never a database. No row was rerun, under the load rule; the orchestrator's full `make test-repro` on main covers them.

**Consequence.** Nothing to regenerate.
