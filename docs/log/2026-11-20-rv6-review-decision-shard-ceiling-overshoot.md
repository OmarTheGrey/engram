---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/shard.ts
supersedes: docs/log/2026-11-20-rv6-decision-shard-ceiling.md
---

**What.** A config's `spend_ceiling_usd` stays the whole run's ceiling per provider and each of n shards stops at a 1/n share, with the overshoot stated: up to n sessions' cost in all, one per shard.

**Why.** As before, shards share no ledger. A tighter bound would need a ledger all shards reach; a session's cost is small against H1's ceiling, so the bound is stated, not engineered away.

**Result.** Unchanged mechanism; documented in AGENTS.md, CLAUDE.md, the Makefile help, `shard.ts` and the plan.

**Consequence.** The lead may set a ceiling n sessions below the budget.
