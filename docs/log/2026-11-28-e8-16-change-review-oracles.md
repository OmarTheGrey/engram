---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/mcp/test/leakage.test.ts
supersedes: none
---

**What.** The denied-and-missing comparison now runs for every probe actor and every canary it may not see, on every id-taking route and tool, and compares the whole normalised answer, status, decision, reason and rule id; the pinned set is built by rule.

**Why.** Review finding 1: one actor and one id missed the erased rule id.

**Result.** `make test-one T=packages/server/test/leakage.test.ts`: 12 passed; 377 comparisons over HTTP, 275 alike, the rest exactly the pinned set (write and checkWrite under each held id, explain, the read counts); MCP 106, 102 alike, the four explain refusals.

**Consequence.** A new oracle on any actor or id fails the suite.
