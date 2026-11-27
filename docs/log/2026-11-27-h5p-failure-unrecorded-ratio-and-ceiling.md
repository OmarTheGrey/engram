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
  - research/tests/test_run_limits.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** The first draft asserted gpt-4.1's list-to-catalogue ratio as 1.0 and stated a ceiling of 901.75 ledger dollars, neither from a regenerable source.

**Why.** The ratio was read from pi-ai's catalogue in node_modules, while the cost table lists gpt-4.1 as unpriced and `test_run_limits.py` records no ratio for it; and the section's own Cost rule says ceilings are computed by the cost table, never in a proposal (review findings F2 and F3).

**Result.** The ratio is now a prerequisite (card H5P row 22), the ledger figures are conditional on it, and no ceiling is stated.

**Consequence.** The harness card records the ratio; the cost table computes the ceiling.
