---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** The H1 runbook in section 7 of `docs/tasks/prereg-v1-plan.md` has no step for the operator's credit check, which now caps H1.

**Why.** Pre-tag condition 7's fallback (read OpenRouter's credit at least every two hours while any shard runs; stop every shard when the credit left falls below one session's high estimate times the running shards, plus 10 percent) is stated only in the pre-registration. The lead chose it for H1 on 2026-11-25.

**Result.** `grep -n -i "credit" docs/tasks/prereg-v1-plan.md` finds nothing. The runbook's live commands also still name `gpt-5.6-terra`, not M1 (backlog row "The smoke run's price and commands").

**Consequence.** Before 1 December the runbook gains the check as a step, with the threshold worked out per arm; a documents-only change the answers card or the operator can make. No card is written for it.
