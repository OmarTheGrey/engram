---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
supersedes: docs/log/2026-11-02-pr2-review-finding-gatemem-reach.md
---

**What.** Under ADR 0030's mapping, a pattern GateMem scores as a leak matches a turn the asker reads on 74.0 percent of forgetting checkpoints and 38.8 percent of access ones; every pattern does on 63.0 and 18.3 percent.

**Why.** On those checkpoints C5 hands the match to the model, which alone can withhold it.

**Result.** These are shares of text matches, not of secrets, and neither bounds the share whose secret is in reach: 2 access and 5 forgetting checkpoints carry only bare patterns, and 107 access and 63 forgetting at least one (`research/results/h1-gatemem-reach.json`). The verifier's 29 compared a list holding duplicates with a set. A hand audit of the 50 sampled checkpoints is the human step that can place the secret's share.

**Consequence.** For PR 4's sheet, undecided: forgetting checkpoints dilute a C4 minus C5 difference.
