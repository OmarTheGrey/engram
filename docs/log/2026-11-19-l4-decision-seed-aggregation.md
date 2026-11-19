---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/h3_lint_delta.py
supersedes: none
---

**What.** The delta reports each seed in full, then each label's flag averaged over the seeds with the recall it gives and a Wilson interval, and the spread of every per-seed rate. A seed-averaged precision carries no interval.

**Why.** The pre-registration averages over seeds within an item before any interval and reports the seed spread; research/analysis/wilson.py takes fractional successes over a whole n, the items, while precision's denominator, the flagged items, is itself a seed average.

**Result.** Per-seed precision has its interval; the averaged one is a point.

**Consequence.** If the lead wants an averaged precision interval, it needs a method named in the pre-registration first.
