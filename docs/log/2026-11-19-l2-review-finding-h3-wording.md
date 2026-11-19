---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
  - research/results/h3-fault-set.json
  - docs/tasks/backlog.md
supersedes: none
---

**What.** H3's statement that "deterministic lints alone find seeded faults with useful precision" holds on card L2's set by construction.

**Why.** Each keyed subtype restates its lint's trigger and the label check requires every keyed fault flagged and no near-miss (review finding L2-1); `limits.can_tell` in the result says the set is a regression check on L1 for that reason.

**Result.** Recommendation for the lead, before the `prereg-v1` tag: restate H3's deterministic claim as precision on natural memory, measured through the audit sample of base-item findings (`audit` in the result, judged by members), and keep recall on seeded faults as a regression check on L1. The pre-registration is not edited here; the decision is the lead's (backlog row "H3's deterministic claim").

**Consequence.** Until the lead decides, L4 reports deterministic seeded recall as a check, not as H3's evidence.
