---
date: 2026-10-25
author: claude-agent
type: change
card: E0.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - packages/core/src/lint.ts
  - packages/core/src/simulate.ts
  - packages/core/src/distill.ts
  - packages/core/test/fakes/index.ts
  - packages/core/test/unit/interfaces.test.ts
  - "pnpm --filter core test"
supersedes: none
---

**What.** Card E0.3 declared the Linter, Simulator and Distiller interfaces and added promote, lint, simulate, distill and explain to the asynchronous Plane, with GateResult, Workload, SimReport, Session, DistillMethod and ReadId types.

**Why.** Cards E2.5, L1, E8.9, D2 and E2.2 implement these methods, and tests above layer 1 need fakes to build on before they land.

**Result.** Fakes in `packages/core/test/fakes/`: a scripted linter (findings per scope), an identity simulator (keeps recorded decisions unless a test scripts `decide`) and a scripted distiller that fails loudly on an unknown key and accepts only procedural candidates. The stub plane rejects each new method with `NotImplementedYet` naming its card. `interfaces.test.ts`: 7 tests pass; `pnpm --filter core test` 64 pass.

**Consequence.** `promote` takes an injected `at`, like `write`; the architecture's interface list omits it there as it does for `write`.
