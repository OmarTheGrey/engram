---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - docs/bundle.md
supersedes: none
---

**What.** A bundle holds every item of the actor's own person scope, whoever wrote it, and the actor's own items in the other scopes the read matrix lets it read, of every status.

**Why.** The card says both "the memories an actor owns" and "scopes the actor owns"; a person scope is the only scope a person owns, and shared scopes hold other members' items.

**Result.** Retired versions come along because a later version's lineage names them; without them lineage could not round-trip. Another member's item in a shared scope is never exported. Export appends no event, as the events route appends none.

**Consequence.** If export must be logged (rule 3), a read-like event needs a Plane method: a follow-up, not this card.
