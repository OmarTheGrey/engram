---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/distill.ts
supersedes: none
---

**What.** `Plane.distill` still throws `NotImplementedYet`. The induction is the `Distiller` interface, built by `createAwmDistiller({ call, frame })`, and the caller writes its candidates through `Plane.write`.

**Why.** `Plane.distill(sessions, method)` has no actor, time or model, and the plane is built with no induction model. The invariants file, owned by the lead, also requires the method to reject as unimplemented.

**Result.** Core's interface is unchanged. The server's `/distill` route still answers 501.

**Consequence.** Wiring `Plane.distill` and the route needs an actor and a time in the signature, plus the lead's change to the invariants file (backlog work).
