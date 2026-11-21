---
date: 2026-11-21
author: claude-agent
type: change
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/research/positioning.md
  - README.md
  - docs/architecture.md
  - docs/readings/litreview/2611.20144-heams.md
  - docs/readings/litreview/2610.22959-safe-mem.md
  - "make lint-docs"
supersedes: none
---

**What.** The review fix pass of card R3: findings R3-1 to R3-7 fixed; R3-8 (the `make thesis` blocker) is left to the coordinator.

**Why.** The independent review found three important and several minor issues, all overclaims or citation slips.

**Result.** R3-1: no model makes a decision or sets a trust-bearing input, with the agent's scope, class and confidence checked by the gate. R3-2: the H2 bullet gives both SAFE-Mem baselines. R3-3: the literature notes corrected in place. R3-4: HEAMS logs recall decisions and retention drops, not every retention decision. R3-5: the README, `docs/architecture.md` and the positioning say `prereg-v1` is tagged before the first run. R3-6: H2 on three models, H1 on M1. R3-7: `PERMISSION_TRUST`, `RetrievalResult` in `base.py`, the erasure exception in `itemsAt`. Six entries superseded, each by a `-v2` or `-applied` entry. `make lint-docs` passes.

**Consequence.** The branch is ready for re-review.
