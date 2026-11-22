---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/promote-replay.test.ts
supersedes: docs/log/2026-11-21-d3-decision-leaky-replay-refused.md
---

**What.** A replay whose split leaks or is not the item's ref's, or that was run for another item, is now one deny event (`engram/promote/replay-split`, `engram/promote/replay-item`), not an `InvalidCallError` (review findings D3-3, D3-6).

**Why.** Once the plane checks a replay against the item, the refusal is a policy decision, and AGENTS.md rule 3 asks an event for every one.

**Result.** `make test-one T=packages/core/test/unit/plane/promote-replay.test.ts`: 9 passed, among them one deny event for a leaked split and none for a malformed replay. Only a malformed replay is still refused before the log.

**Consequence.** Both rule ids are on the dogfood report's list.
