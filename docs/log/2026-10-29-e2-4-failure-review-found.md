---
date: 2026-10-29
author: claude-agent
type: failure
card: E2.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/retention-review.test.ts
  - docs/decisions/0025-retention-semantics.md
supersedes: none
---

**What.** PR 4 passed every gate and its mutation checks, yet the independent review found five important defects: utility eviction of the write that just landed, expired items holding budget slots, retired content plantable by writing an item as retired, eviction reasons leaking to non-readers, and irreversible ttl retirement of shared scopes by any member's clock. On the way to fixing them, the manual-ask check first queried a `policy_id` column the events table does not have.

**Why.** The tests encoded what the ADR said, not what a full scope, a hostile member or a skewed clock does to it; the invariants' oracle mirrored the same reading.

**Result.** Each defect now has a test that failed on the reviewed code; the column query reads the event body instead.

**Consequence.** Adversarial probes (a hostile member, a wrong clock, a full scope) belong in the acceptance tests of every policy card.
