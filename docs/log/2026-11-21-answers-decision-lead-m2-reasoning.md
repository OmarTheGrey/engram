---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/tasks/lead-decisions.md
  - docs/research/preregistration.md
  - docs/log/2026-11-21-answers-finding-m2-reasoning-off.md
supersedes: none
---

**What.** The lead keeps GLM 5.3 Flash as M2 and amends v1's Models rule: a model that cannot switch reasoning off runs at its provider's default effort on a pinned endpoint, its reasoning tokens metered, its cost estimated with the reasoning allowance, and the report saying so (lead-decisions item 57, the lead's own answer of 2026-11-21).

**Why.** pi-ai 1.3.0 maps M2's reasoning off to nothing, which the rule as written excluded (review finding ANS-2).

**Result.** v1 names M2 as such a model, states that M1 and M3 run with reasoning off, and that the comparison across models, H4 and H2's subsets, is across configurations, each stated.

**Consequence.** H4's reading of a model difference includes the reasoning configuration.
