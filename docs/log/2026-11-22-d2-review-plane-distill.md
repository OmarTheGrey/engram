---
date: 2026-11-22
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - docs/tasks/backlog.md
  - packages/server/src/routes.ts
supersedes: docs/log/2026-11-21-d2-decision-plane-distill.md
---

**What.** `Plane.distill` still throws `NotImplementedYet`, now naming `backlog` rather than card D2. The server's 501 and its route summary say the same. A backlog row, "Plane.distill and the /distill route", states what is left.

**Why.** Review finding D2-10: D2 is done, and no card (D3, X11 or any other) implements the method.

**Result.** `make api` regenerated three lines of `sdk/` and `packages/ui/src/api/`, and `make api-check` passes. The server's contract test and core's interface test expect `backlog`.

**Consequence.** The card that wires it names itself in the error.
