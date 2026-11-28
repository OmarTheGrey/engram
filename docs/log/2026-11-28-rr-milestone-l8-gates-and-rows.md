---
date: 2026-11-28
author: claude-agent
type: milestone
card: L8
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-27-l8-measurement-gates-and-rows.md
  - "make test"
supersedes: docs/log/2026-11-27-l8-measurement-gates-and-rows.md
---

**What.** Card L8's merge gate of 2026-11-27, restated as a milestone: a gate run, not a number a research script makes from a config.

**Why.** Typed as a measurement with no results file or config, the entry made `make thesis` fail.

**Result.** As the superseded entry records, at 282c3c66: `make lint`, `make lint-docs` and `make test` exited 0 (vitest 6,773 passed, 42 skipped; pytest 564 passed), and the four MANIFEST rows the lint code reaches (h3-lint-floor, h3-near-duplicate, h3-lint-nli, h3-fault-set), rerun alone, matched their committed sha256.

**Consequence.** Nothing beyond the record: L8 merged as #124.
