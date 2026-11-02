---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/bootstrap.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** H4's two one-sided tests use bootstrap shares: p_lower is the share of resamples at or below minus the margin, p_upper the share at or above the margin, and a pair is equivalent when both are below 0.05.

**Why.** The pre-registration names TOST but not its form. These shares are the primary test's p-value moved to each margin, on the same paired, seed-averaged resamples. Equivalence across three arms is an intersection-union test: every pair must pass at 0.05, no multiplicity correction.

**Result.** `tost` also marks a pair whose differences are all equal as degenerate: its bootstrap is a point and it passes whatever the margin. Cost if wrong: a pair with no discordant item at small n is declared equivalent; the power table counts such studies both ways.

**Consequence.** PR 4 states the form and the degenerate case in v1.
