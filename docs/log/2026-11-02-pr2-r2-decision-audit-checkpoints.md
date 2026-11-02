---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_gatemem_reach.py
  - research/configs/h1-gatemem-reach.json
supersedes: docs/log/2026-11-02-pr2-review-decision-audit-sample.md
---

**What.** The reach result's audit sample is 25 seeded checkpoints per kind (seed 20261102), drawn among those with a scored pattern in reach, each with all its patterns and every match with its turn text.

**Why.** A hand audit should estimate the share of reachable checkpoints whose match is the secret (review finding V5), which needs checkpoints, not matches, drawn uniformly.

**Result.** Cost if wrong: 25 per kind estimates that share to about plus or minus 0.2. The audit is a human step and is not done.

**Consequence.** PR 4 or the lead records the audit's result.
