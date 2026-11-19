---
date: 2026-11-19
author: claude-agent
type: finding
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-longmemeval-ttl.json
  - docs/tasks/B6.md
supersedes: none
---

**What.** Options for the clock problem on LongMemEval, each with its cost, and one recommendation, for the lead (`docs/tasks/B6.md`, section on the clock).

**Why.** Medium's ttl can move H2's primary contrast by up to 7.6 accuracy points, above a bound of 10 percent of C2's utility whenever C2 scores under 76 percent.

**Result.** The last-session clock still hides 6,938 turns in 42 questions and departs from upstream's question date; the wall clock hides every turn; a benchmark preset (medium with a ttl above 312 days) hides nothing but changes H2's registered primary; leaving it costs nothing to build. Recommended: keep the question's date and medium as registered, and register a sensitivity analysis, C2 minus C5 on the 446 questions where medium hides no turn, beside the primary.

**Consequence.** The lead decides before the tag; the pre-registration and the presets are unchanged.
