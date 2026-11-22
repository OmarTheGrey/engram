---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** Protection covers active items, writes (rewrites and retires by status), budget evictions by writes, adoptions, promotions and sweeps; not candidates, ttl retirement, a promotion's supersession or grant changes.

**Why.** ADR 0040 names rewrites, retires and evictions of active items; card E2.7 left ttl retirement out (its retire decision entry).

**Result.** A ttl is set by the item's writer or its rule; a supersession keeps the content in a new version (ADR 0026); a grant change keeps content and kind and has its own owner rule (ADR 0034). A promotion whose landing would need a more trusted victim is denied like a write, so no budget is left exceeded.

**Consequence.** Each exclusion is a sentence in `protectionProblem`'s comment; a card that wants one in adds its cases.
