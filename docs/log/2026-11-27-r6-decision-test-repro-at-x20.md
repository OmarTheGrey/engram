---
date: 2026-11-27
author: claude-orchestrator
type: decision
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/results/MANIFEST.md
  - "make test-repro"
supersedes: none
---

**What.** R6 merges on its gates and its five reachable MANIFEST rows (h1-cost, h1-check-runs-cost, h2-cost-table, h2-longmemeval-cost and h3-lint-floor, each rerun alone and matching its committed sha256). The full `make test-repro` runs once, at X20's head after main with R6 is merged into it, before X20 merges and before the tag.

**Why.** The runner change in R6 is in the live path only, which no research script takes, and a full run takes about three hours on this machine. One run at the later head covers R6's code as well.

**Result.** R6's gates: `make lint` 0, `make lint-docs` 0, `make test` 0 (vitest 6,729 passed; pytest 561 passed).

**Consequence.** A row that fails at X20's head because of R6 is fixed in a PR before the tag.
