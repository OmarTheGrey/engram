---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/shard.ts
  - AGENTS.md
supersedes: none
---

**What.** That a sharded run can pass `spend_ceiling_usd` by up to n sessions' cost was not written down (review P60-6).

**Why.** Each shard checks its share before each session and finishes a session started under it, so each of n shards can overshoot by one session.

**Result.** Stated in `shard.ts`, AGENTS.md and CLAUDE.md, the Makefile help and section 7 of the plan; the decision entry on the split is superseded.

**Consequence.** The lead sets the ceiling knowing the overshoot.
