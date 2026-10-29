---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/property/visible-events.test.ts
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** Review finding R3-4: membership still decides which events a viewer sees, but an event's `item` is kept only when the read filter would return that item to the viewer now, as carried and as projected.

**Why.** Allowed writes and promotions carry the full item; under the strict preset a role-level member of a person scope got that scope's content through `POST /events`, which `Plane.read` would never return.

**Result.** `visibleEvents(viewer, events, { policy, at, current })` withholds such items and keeps the rest of the event. A property test with its own readability oracle checks 1000 generated worlds; removing the strip failed 3 tests, ignoring the projection 2.

**Consequence.** The timeline can name an event whose content the viewer cannot read; PR 4 shows it without content.
