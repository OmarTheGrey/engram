---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - packages/core/src/policy/grants.ts
supersedes: none
---

**What.** Only an item's owner, user-sourced and a member of its scope, may change its grants; an outsider gets the same refusal for an unknown and a hidden item, naming no scope.

**Why.** ADR 0021 makes grants consent, which is a person's act; offboarding already requires a user-sourced actor for the same reason. Membership alone (what `Plane.write` asks of a rewrite) would let another holder of a role change the grants on items its owner wrote.

**Result.** Rule ids `engram/grant/owner` and `engram/grant/source`, checked membership, then source, then owner (`packages/core/test/unit/policy/grants.test.ts`). An agent acting for the owner, with source `model`, is always refused.

**Consequence.** If the lead prefers any member of a role scope to manage its grants, the owner check becomes a membership check, one line and its tests.
