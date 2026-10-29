---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/contract.ts
  - packages/server/src/routes.ts
  - packages/server/test/contract.test.ts
  - sdk/openapi.json
supersedes: none
---

**What.** The explain route's response gains `counts`, the `ReadCounts` component, null when the read event's reason is not in the form `formatReadReason` writes.

**Why.** The plan says the route returns the counts with the explanations but not their shape, nor what happens for a log written before the current reason (the ttl category joined it with E2.4). Refusing the explain for an old read would hide explanations the plane still holds.

**Result.** The route calls `Plane.explain` first, so an unknown read is 404 and another actor's read 403 before the event is looked up; the counts come from core's `readCounts`. `make api` regenerated `sdk/openapi.json`, `sdk/ts` and `packages/ui/src/api`. The contract test checks `counts` equals `readCounts` of the read's event and its `filtered` equals the read's.

**Consequence.** The explain view prints a line instead of the counts for such a read.
