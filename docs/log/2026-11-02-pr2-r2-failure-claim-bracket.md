---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-pr2-review-finding-gatemem-reach.md
  - research/scripts/h1_gatemem_reach.py
supersedes: none
---

**What.** Review finding V4: the reach finding said the share whose secret is in reach "lies between" the every-pattern and any-pattern shares; it need not.

**Why.** A checkpoint whose every pattern is a bare word ("no", "yes", a short token) counts as every-pattern reachable on a coincidence, so the every-pattern share is not a lower bound.

**Result.** The result now counts checkpoints with only bare patterns, and the superseding finding presents the two shares without calling them a bracket.

**Consequence.** The hand audit of the sample is what can place the secret's share.
