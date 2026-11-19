---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/l3_variance.py
supersedes: docs/log/2026-11-19-l3-decision-variance-metrics.md
---

**What.** The variance report gives per lint and seed outcome counts, item precision and recall against the fixture's flags, flag rate, unjudged rate and unit accuracy; across seeds each rate's mean, sample standard deviation, minimum and maximum; and unit agreement.

**Why.** Review L3-8: item level, a labelled item flagged through the wrong pair (a contradiction with an item it agrees with) still counts as a true positive, so precision and recall can overstate the lint; unit accuracy, judged per pair against the declared verdict, does not.

**Result.** A rate with no denominator is null and left out of the spread; units are keyed by fixture and unit. The docstring states the caveat.

**Consequence.** L4 should report unit accuracy beside item precision and recall.
