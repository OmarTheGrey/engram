---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
  - packages/server/test/leakage.test.ts
supersedes: docs/log/2026-11-28-e8-16-decision-erased-id.md
---

**What.** The erased item's id is exempt from the leak count only for members of person:fred (fred, and the member who offboarded him); to anyone else it is a leak, and its content in any shape is a leak to everyone.

**Why.** ADR 0010 keeps the erase events and their ids for the scope's members; the first rule exempted the id for every actor, broader than the ADR (review finding 2).

**Result.** A scanner test pins it: the erased id counts for mallory, not for fred; the nonce counts for both.

**Consequence.** An event-visibility regression that showed person:fred's events to a non-member is now counted.
