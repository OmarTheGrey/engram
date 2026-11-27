---
date: 2026-11-27
author: claude-orchestrator
type: measurement
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "make test"
supersedes: none
---

**What.** At e8e112fc (E9.9 with main through L8 merged in), on a quiet machine: `make lint` 0, `make lint-docs` 0, `make test` 0 (vitest 6,815 passed, 44 skipped; pytest 564 passed). The five rows promotion reaches were rerun alone: h1-crosswalk, h1-injection-screen, h1-secret-guard, h1-redteam and h2-perf-budget.

**Why.** E9.9 was verified on 2026-11-25 and paused before its gates; main has moved since, the TUI included.

**Result.** All five rows match their committed sha256.

**Consequence.** E9.9 merges.
