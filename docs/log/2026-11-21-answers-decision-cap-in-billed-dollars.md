---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - research/tests/test_run_limits.py
  - research/results/h2-cost-table.json
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: none
---

**What.** The programme-wide cap is stated in billed dollars, and an HTTP 401, 402 or 403 from the provider stops a run (the coordinator's decisions under the lead's delegation, verification finding V-1).

**Why.** OpenRouter bills the credit in list dollars and the ledger meters catalogue dollars, half that for M1: a 1,000 dollar credit runs out after about 605 ledger dollars of H1's GateMem arm, below its 945.29 ceiling.

**Result.** The runner card converts each paid call's ledger cost by its model's recorded ratio, input and output apart; a model with no recorded ratio refuses to run under the cap. Until it lands, the operator reads OpenRouter's credit balance at least every two hours while shards run and stops them all below one session's cost per running shard plus 10 percent.

**Consequence.** On that credit the cap binds H1 before its ceiling; v1, ADR 0017 and the backlog say so.
