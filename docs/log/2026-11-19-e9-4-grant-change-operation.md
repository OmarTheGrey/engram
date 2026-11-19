---
date: 2026-11-19
author: claude-agent
type: change
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/grants.ts
  - packages/core/src/plane/grants.ts
  - packages/core/test/unit/plane/grants.test.ts
  - packages/core/test/property/grants.test.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - "pnpm exec vitest run packages/core/test/unit/plane/grants.test.ts"
supersedes: none
---

**What.** Core gained `Plane.changeGrants`, the owner's grant change as a governed write: before, no operation changed an item's grants except a member's whole rewrite through `Plane.write`; after, a pure gate (`evaluateGrantChange`) decides and the plane commits one `update` event per decision, an allowed change being a new version in place rewritten to the store.

**Why.** Card E9.4's acceptance is "grant change recorded as an event", and no core operation made one (plan decision 4: in core, behind the gate, no schema change).

**Result.** No schema change. The acceptance file passes against the real Plane under the twin profile (20 tests: add, remove, expiry, visibility, replay, refusals, store failures), and a property test over 300 generated cases checks one event per call and agreement with an independent oracle. Mutation checked: dropping the owner check, or the event's new grants, fails them.

**Consequence.** ADR 0034 (proposed) records the rule for the lead.
