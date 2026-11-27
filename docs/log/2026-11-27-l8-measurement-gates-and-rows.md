---
date: 2026-11-27
author: claude-orchestrator
type: measurement
card: L8
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/results/MANIFEST.md
  - "make test"
supersedes: none
---

**What.** At 282c3c66 (L8 with main through X20 merged in), on a quiet machine: `make lint` 0, `make lint-docs` 0, `make test` 0 (vitest 6,773 passed, 42 skipped; pytest 564 passed). The four MANIFEST rows the lint code reaches were rerun alone: h3-lint-floor, h3-near-duplicate, h3-lint-nli and h3-fault-set.

**Why.** L8 was verified on 2026-11-25 and paused before its gates; main has moved since (R5, R6, X20, X21, H5P).

**Result.** All four rows match their committed sha256.

**Consequence.** L8 merges.
