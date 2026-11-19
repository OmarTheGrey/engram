---
date: 2026-11-19
author: claude-agent
type: change
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/src/plane/lint.ts
  - packages/core/test/unit/lint/model.test.ts
  - packages/core/test/unit/plane/lint-model.test.ts
  - packages/core/test/property/lint-leak.test.ts
supersedes: none
---

**What.** Card L3's two model-based lints, contradiction and unsupported-claim, are in core, run by Plane.lint after the deterministic tier when the plane is built with a lint model.

**Why.** ADR 0008 asks for a model-based tier reported separately in H3, taking an injected ModelCall (AGENTS.md rule 4); H3 measures it on card L2's seeded-fault set.

**Result.** Before: Plane.lint ignored model lint ids. After: `PlaneDeps.lintModel` (call, model, seed) runs them; each flag is one `lint` event of L1's shape with the call's usage; `LintReport.judgments` lists every unit sent; `planModelLints` lists the units without a call. 37 new unit tests and a second lint-leak property pass (`pnpm exec vitest run packages/core/test/unit/lint packages/core/test/unit/plane/lint-model.test.ts packages/core/test/property/lint-leak.test.ts`).

**Consequence.** The server and CLI inject no lint model, so they behave as before; the runner injects one.
