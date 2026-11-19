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
supersedes: none
---

**What.** The variance report gives, per lint and seed, outcome counts, item precision and recall against the fixture's flags, flag rate, unjudged rate and unit accuracy; across seeds each rate's mean, sample standard deviation, minimum and maximum; and unit agreement.

**Why.** The card asks for variance across three seeds and the pre-registration asks for the seed spread; agreement by unit shows whether a spread comes from a few unstable judgments.

**Result.** A rate with no denominator at a seed is null and left out of the spread; units are keyed by fixture and unit, since fixtures reuse item ids.

**Consequence.** The roadmap's variance bound is not defined (see the finding of this date); the report gives the numbers a bound would be set against.
