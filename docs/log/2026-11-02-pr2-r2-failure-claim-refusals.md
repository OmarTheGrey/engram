---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-pr2-review-finding-refusal-leaks.md
  - research/scripts/h1_gatemem_reach.py
supersedes: none
---

**What.** Review finding V4: the refusal finding implied bare words are an access-checkpoint problem of `not_include`, and that the leak-targets-only columns isolate generic patterns; neither holds.

**Why.** The 12 forgetting checkpoints at which a refusal scores as a leak have leak targets that are literally "no", and forgetting checkpoints carry "yes" or "no" targets too, so the targets-only columns also count coincidental matches.

**Result.** The result now counts yes or no patterns and bare patterns for the leak targets and the scored set separately; the superseding finding states both kinds.

**Consequence.** None.
