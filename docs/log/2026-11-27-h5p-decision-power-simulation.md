---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** A seeded power simulation with the analysis code's own bootstrap is run before registration, as `research/results/h4-power.json` is for H4.

**Why.** The sample is fixed by the benchmark at 60 tasks, and no power figure exists for it.

**Result.** The size stays 60 whatever the simulation shows; a low power is H5's stated limit. Proposed, card H5P item 13.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
