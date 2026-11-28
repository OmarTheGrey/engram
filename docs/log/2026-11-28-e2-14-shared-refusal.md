---
date: 2026-11-28
author: claude-agent
type: change
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/options.ts
  - packages/core/src/plane/simulate.ts
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
  - packages/server/test/contract.test.ts
supersedes: none
---

**What.** The refusal of the options nothing builds yet moved into one pure core function, `notBuiltOptions` (`policy/options.ts`), applied by the loader, by `Plane.simulate` to its candidate (an `InvalidCallError`, so `POST /api/v1/simulate` answers 400) and by `exportCedar` (a `CedarExportError`).

**Why.** The orchestrator's decision on the review of 2026-11-28: the HTTP route's candidate never met the loader. This is the card's own refusal, so it is in scope.

**Result.** `load-options.test.ts`: 61 passed, each option refused by `notBuiltOptions`, `exportCedar` and `Plane.simulate` with nothing logged; the server's contract test: 39 passed, the route's 400 naming card E2.21. Mutant: with the simulate and Cedar guards disabled, 14 core tests and 1 server test fail.

**Consequence.** A consuming card deletes one row of `NOT_BUILT_YET` in `policy/options.ts`; all three readers follow.
