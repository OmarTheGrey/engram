---
date: 2026-11-27
author: claude-agent
type: failure
card: H5P
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - research/results/h2-cost-table.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** The first draft counted 2 to 104 induction calls, where its own rule (at most one call per induction-half task) caps them at 52.

**Why.** 104 is the whole train list, or the old cost table's habit of counting induction under both C2 and C5, which the draft's shared library drops (review finding F1).

**Result.** The high bound moved from 1,029.69 to 1,027.45 billed dollars, the ledger high from 721.40 to 720.28, the reasoning sensitivity from 1,139.43 to 1,136.98; the low end did not move.

**Consequence.** Bounds reworked in the draft, the card and the cost entries.
