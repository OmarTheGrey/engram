---
date: 2026-11-28
author: claude-agent
type: milestone
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-27-x20-measurement-test-repro-at-head.md
  - "make test-repro"
supersedes: docs/log/2026-11-27-x20-measurement-test-repro-at-head.md
---

**What.** Card X20's gate and full `make test-repro` at a553b311, restated as a milestone: a gate run over every MANIFEST row, not one result from one config.

**Why.** Typed as a measurement with no results file or config, the entry made `make thesis` fail.

**Result.** As the superseded entry records: `make lint`, `make lint-docs` and `make test` exited 0 (vitest 6,760 passed, 42 skipped; pytest 564 passed); 23 of 24 rows matched in the run, and `h1-redteam.json`, stopped for want of its two pinned payload sets in `.engram/upstream`, matched once they were supplied. All 24 rows match.

**Consequence.** Nothing beyond the record: X20 and R6 moved no MANIFEST row and merged.
