---
date: 2026-11-28
author: claude-agent
type: milestone
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-27-e9-9-measurement-gates-and-rows.md
  - "make test"
supersedes: docs/log/2026-11-27-e9-9-measurement-gates-and-rows.md
---

**What.** Card E9.9's merge gate of 2026-11-27, restated as a milestone: a gate run, not a number a research script makes from a config.

**Why.** Typed as a measurement with no results file or config, the entry made `make thesis` fail.

**Result.** As the superseded entry records, at e8e112fc: `make lint`, `make lint-docs` and `make test` exited 0 (vitest 6,815 passed, 44 skipped; pytest 564 passed), and the five MANIFEST rows promotion reaches (h1-crosswalk, h1-injection-screen, h1-secret-guard, h1-redteam, h2-perf-budget), rerun alone, matched their committed sha256.

**Consequence.** Nothing beyond the record: E9.9 merged as #125.
