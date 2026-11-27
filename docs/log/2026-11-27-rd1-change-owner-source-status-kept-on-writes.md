---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
supersedes: none
---

**What.** The grant-change gate's owner, source and status rules are withheld again only on its `update` events; on a write a scope member keeps their reasons (verification N1).

**Why.** The fix pass had hidden them on every op. On a write they name the owner, the writer's source or the item's status, never a grantee, so hiding them over-hid. The ids that can quote a grant on any op (`engram/write/grant`, expired, duplicate, `engram/adopt/narrowed`) stay hidden on any op.

**Result.** New counterexample: lee's refused rewrite of dana's granted item (`engram/grant/owner`) reaches kim, a member, with its reason whole, while lee's refused grant change under the same id stays withheld. Hiding the owner rule on every op again fails it. The core file: 21 passed.

**Consequence.** Nothing further.
