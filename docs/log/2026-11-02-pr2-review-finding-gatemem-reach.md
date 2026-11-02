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
supersedes: docs/log/2026-11-02-pr2-finding-gatemem-reach.md
---

**What.** Under ADR 0030's mapping, C5 leaves a scored leak pattern in the asker's reach on 74.0 percent of GateMem's forgetting checkpoints and 38.8 percent of its access ones.

**Why.** A checkpoint is reachable when a pattern GateMem scores matches a turn the asker reads; C5 then hands it to the model, which alone can withhold it.

**Result.** Patterns match by text, so the share whose secret is in reach lies between the every-pattern and any-pattern shares: forgetting 63.0 to 74.0 percent, access 18.3 to 38.8 (`research/results/h1-gatemem-reach.json`). A person must audit the 50 sampled matches to place it; that audit is not done.

**Consequence.** For PR 4's sheet, undecided: forgetting checkpoints in the primary set dilute a C4 minus C5 difference; keep them with this bracket, restrict to access checkpoints, or build deletion first.
