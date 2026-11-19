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
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** `Plane.write` still lets any member of a scope rewrite an item with other grants (decision D4 checks each grant); this card does not narrow it to the owner.

**Why.** Narrowing it changes the invariants' write oracle in `packages/core/test/property/invariants.test.ts`, which the lead owns and which needs a second reviewer; one card per PR keeps that out of E9.4.

**Result.** ADR 0034's consequences put it to the lead with the recommendation to narrow it in a follow-up card. In a person scope only the owner is a member, so on the twin's person scopes the two paths admit the same actor.

**Consequence.** Until then a role member can change grants on a co-holder's role item by rewriting it.
