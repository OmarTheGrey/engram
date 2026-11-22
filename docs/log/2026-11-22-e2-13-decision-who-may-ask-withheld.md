---
date: 2026-11-22
author: claude-agent
type: decision
card: E2.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/test/property/who-can-read.test.ts
supersedes: docs/log/2026-11-21-e2-13-decision-who-may-ask.md
---

**What.** Who is answered is unchanged: an actor the read filter admits the item to, or a member who may read its scope; the owner is the `changeGrants` owner. What changed, by the lead's decision on review finding E2.13-1: a member asking about an item closed to every reader is not told its owner, and its `closed` reason is "closed to every reader now" with the rule id only.

**Why.** The earlier entry said answering a member "reveals nothing new". The review reproduced on a real Plane that a member who cannot read a retired, candidate, expired or not yet valid item learned its owner id, validity window and ttl expiry.

**Result.** The leak property now asserts that such an answer holds neither the owner id nor any of those instants; 6 of 6 tests pass.

**Consequence.** An admitted reader keeps the owner id, which `Plane.read` already gives it.
