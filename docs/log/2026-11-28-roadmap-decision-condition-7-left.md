---
date: 2026-11-28
author: claude-agent
type: decision
card: none
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
  - docs/log/2026-11-27-orch-change-runbook-credit-check.md
supersedes: none
---

**What.** The roadmap counts pre-tag condition 7 as left, held for H1 by the operator's credit check, not as done.

**Why.** The condition is met either by the runner enforcing the cap (card X22, after H1's `MERGE=4`) or by the operator reading OpenRouter's balance while shards run. The runbook names the check (#123), but the check is an act during the run, and the pre-registration's header carries no done mark for it. Another reader could call it done once the runbook holds the step.

**Result.** Conditions 2, 3, 5 and 6 are listed as done; 1, 4, 7 and 8 as left, with 7's owner the operator of H1's runs.

**Consequence.** None for the tag: the lead tags with the runbook's check in place.
