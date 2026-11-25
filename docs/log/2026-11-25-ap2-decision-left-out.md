---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/absorb-plan-2.md
  - docs/research/absorb/long-list.md
supersedes: none
---

**What.** The injection classifier tier, the framework adapters, the MCP SDK migration, the hot-path rewrite, delegation and log backup were left out of the thirty.

**Why.** Each ranked below the thirty on the tests: the classifier waits for proposal P2 and a tested premise after card L7's scores did not separate; the frameworks and MCP migration serve no hypothesis; the hot paths touch the read and write paths during the frontier runs; delegation has no failing test yet; backup a member can do by hand.

**Result.** They are listed with reasons in section 7 and stay candidates.

**Consequence.** If H1's poisoning arm needs a model tier, the classifier is the first to add.
