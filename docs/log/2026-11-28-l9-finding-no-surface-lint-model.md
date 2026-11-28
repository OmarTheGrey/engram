---
date: 2026-11-28
author: claude-agent
type: finding
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/core/src/plane/lint.ts
supersedes: none
---

**What.** No product surface builds a plane with a lint model: the server's lint route, the CLI and the TUI run `workspace.plane.lint` with no `PlaneDeps.lintModel`, so they run the deterministic lints only, whatever the policy enables.

**Why.** Found while wiring the quotes into `engram lint`.

**Result.** With `lints.model.evidence` on, `engram lint` today shows no quote, since it runs no model lint; quotes reach it, the inspector and the event log only from a host that injects a lint model (the runner, or a later card wiring pi-ai through the pi extension). The TUI frames use fixture findings, as every lint frame does.

**Consequence.** A card that gives a product surface a lint model (rule 4: injected at the boundary) gets the quotes with no further change.
