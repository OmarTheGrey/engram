---
date: 2026-11-06
author: claude-agent
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - fixtures/faults/expired-validity.flag.json
supersedes: none
---

**What.** expired-validity flags an active item whose valid_to is not after the lint time, or that is past its ttl (the tighter of its own and its retention rule's, `itemExpiry` of ADR 0025).

**Why.** Validity is truth (ADR 0005) and ttl is retention; reads already exclude an item past either, but it stays active and holds a slot until something retires it. The lint makes that visible.

**Result.** The flag fixture has one item past valid_to and one past its own ttl; the near-miss has each one second short. Equality counts as expired, as `isExpired` does. Candidates and retired items are not linted.

**Consequence.** A sweep by `Plane.retain` clears the ttl case; the valid_to case needs a new version or a retirement.
