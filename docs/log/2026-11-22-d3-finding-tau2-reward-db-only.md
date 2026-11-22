---
date: 2026-11-22
author: claude-agent
type: finding
card: D3
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - packages/runner/src/replay-validate.ts
  - packages/bench/src/tau2/result.ts
supersedes: none
---

**What.** `tau2Reward`, the replay's tau2 oracle, reads `db_match` alone, so a tau2 row with no database check (`db_check` null, `db_match` false) always fails. That is not H5's metric, `tau2_reward`, the product over the task's whole reward basis.

**Why.** Review finding D3-9, recorded for card X11.

**Result.** A task whose reward basis has no DB part scores 0 in the replay while tau2 may reward it 1; a task with DB and NL parts can pass the replay and fail H5's metric.

**Consequence.** Card X11 decides, with the lead, whether replay admission scores tau2 tasks by `tau2_reward` or by the database check, and states it before H5's runs.
