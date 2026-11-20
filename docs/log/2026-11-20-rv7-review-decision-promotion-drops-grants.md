---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
supersedes: none
---

**What.** For RV7-R1, the new version drops the grants when the promoter is not the owner, rather than being refused.

**Why.** A reviewer is never the owner (ADR 0026), so refusing would make a granted item impossible to widen by review at all. That would remove a legitimate flow, not narrow one. Dropping the grants removes the leak, since no grant survives that its owner cannot remove, and the reviewed widening still works. A grant is consent to one item in its scope, and the owner can grant the new item again where they are a member.

**Result.** Tests: Lee's promotion carries no grant and Sam reads nothing; Dana's own episodic-to-semantic promotion keeps hers.

**Consequence.** A reviewed widening into a scope the owner is not in still takes the item out of the owner's reach. That is ADR 0026's design, and it is a backlog row for the lead.
