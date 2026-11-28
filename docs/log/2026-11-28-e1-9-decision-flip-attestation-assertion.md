---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/chain.test.ts
supersedes: none
---

**What.** chain.test.ts's migration case, which asserted that an edited attestation verifies clean, now asserts that a row added after its event was chained fails at `attestations`, and that the earlier row is counted uncovered.

**Why.** The assertion pinned the gap this card closes; it is not an acceptance test of this card.

**Result.** The case still applies migration 5 after 6 and before it, on both backends.

**Consequence.** nothing
