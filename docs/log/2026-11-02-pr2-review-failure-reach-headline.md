---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-pr2-finding-gatemem-reach.md
  - research/scripts/h1_gatemem_reach.py
supersedes: none
---

**What.** Review finding P2-3: the reach finding called the located-but-unreachable share an upper bound on what C5 can prevent, without defining the shares.

**Why.** Patterns match by text, and a generic one ("Wednesday") can match a turn holding nothing secret, so no share bounds the secret's reach; and the shares did not sum to one, because checkpoints with no located pattern (1 forgetting, 10 access) were left undefined.

**Result.** The result now puts each checkpoint in exactly one of three groups (reachable, located but unreachable, not located), reports the any-pattern and every-pattern shares as a bracket, and writes a seeded audit sample of matches for a person to check by hand.

**Consequence.** The finding is superseded; the hand audit is a human step.
