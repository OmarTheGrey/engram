---
date: 2026-10-25
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/apply-event.test.ts
  - packages/core/test/replay/items-at.test.ts
  - packages/core/test/unit/items.test.ts
  - packages/core/test/generators.ts
  - packages/core/src/simulate.ts
  - packages/core/test/fakes/simulator.ts
  - "pnpm --filter core test"
supersedes: none
---

**What.** Fixed review findings R2-1 to R2-6 on PR #2 (cards E0.3, E1.2, E1.3), each test first.

**Why.** The review found the projection rule untested, store refs wrongly unique, a property test that never generated refs, two stale log entries and an undocumented `SimDecision.policy_id`.

**Result.** `applyEvent` has 21 unit tests and the replay fixture a hand-written oracle; removing its decision guard now fails 11 tests, where before every test passed. Decision D1 is applied: migration 2 edited in place with a non-unique index, `itemByStoreRef` returns the latest active holder (ADR 0002 and 0005 amended). Generated items share three refs, and a property checks the lookup against an oracle. `SimDecision.policy_id` is the deciding rule's id. Core runs 114 tests, up from 83.

**Consequence.** The write gate (PR #5) must enforce non-decreasing versions on rewrite (D4) and store-failure events (D6).
