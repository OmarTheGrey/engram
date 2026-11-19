---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/property/visible-events.test.ts
  - packages/core/test/unit/visible.test.ts
  - docs/decisions/0009-retrieval-explanations.md
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** An event is shown to a member of a scope it names only when the read matrix lets the member's level read that scope. Its maker still sees it. This fixes core review finding RV-CORE-4 and closes the backlog row "Events to members who may not read".

**Why.** Under the twin profile, a role context that is a member of a person scope read no items, but it saw the scope's write events and a duplicate lint whose reason carries a strict content hash.

**Result.** The review's repro on the real Plane, and the property whose oracle now follows the read matrix, both failed on main and pass now. One unit test that expected such an event shown with its item withheld now expects it hidden.

**Consequence.** `eventVisibleTo` takes the policy. The `/events` route's description in `routes.ts` (card RV5's file) still says membership.
