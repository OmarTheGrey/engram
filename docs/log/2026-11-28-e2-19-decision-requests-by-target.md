---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - docs/decisions/XXXX-approval-queue-as-a-projection.md
supersedes: none
---

**What.** A request is keyed by item id, version and target, not by id and version alone; refuse takes an optional target, defaulting to the item's own scope's request, else the only one.

**Why.** Finding F3: a widening ask joined the held write's request and inherited its route and expiry, so the wrong approvers were offered it. This amends the plan's 2026-11-25 key by adding the target, still with no event field: the target is the event's `scope_to`.

**Result.** The queue, the evaluator's closure and the oracle all read the target.

**Consequence.** E8.8's queue shows one row per target.
