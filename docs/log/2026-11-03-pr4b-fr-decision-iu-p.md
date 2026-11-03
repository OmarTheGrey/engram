---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-03-pr4b-decision-iu-p.md
---

**What.** Recommended, for the lead's decision: H4's Holm input is the intersection-union p, and each hypothesis's primary p is the one its Test field names (decision sheet item 13g).

**Why.** the final verification of PR #27 (V-14): v1 called every primary p but H4's a share of resamples at or below zero, which H2's support rule, a small C2 minus C5, does not fit.

**Result.** H1, H3 and H5: the one-sided paired bootstrap p of the tested difference. H2: the share of resamples at or above its bound, the proposed 10 percent of C2's utility. H4: the intersection-union p.

**Consequence.** H2's analysis code (card X9) implements that p.
