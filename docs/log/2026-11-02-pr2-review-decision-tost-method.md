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
  - research/tests/test_analysis.py
supersedes: docs/log/2026-11-02-pr2-decision-tost-shares.md
---

**What.** H4's TOST holds each side to alpha / 2 and decides a side by an exact binomial bound when fewer than 10 items differ towards it, by the paired bootstrap otherwise.

**Why.** The percentile bootstrap held to alpha overshoots its level at the margin with a skewed count (its spread shrinks with the observed mean) and fails outright with few discordant items. Since |d| <= 1, the share of items differing towards a margin bounds the mean, so the exact route is valid at any n.

**Result.** A pair with no discordant item passes only from log(0.025) / log(1 - margin) items: 183, 72 and 36 at 2, 5 and 10 points. Rejected: a BCa TOST (closer, not at level) and a betting interval (valid, about twice the items). Cost if wrong: larger sizes than needed.

**Consequence.** PR 4 states the form in v1.
