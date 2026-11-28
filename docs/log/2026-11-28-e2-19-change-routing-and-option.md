---
date: 2026-11-28
author: claude-agent
type: change
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/policy/options.ts
  - packages/core/src/policy/load.ts
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** The `approval` option is built: its row in `NOT_BUILT_YET` is gone; the evaluator refuses a review by a reviewer the target's route does not name (`engram/approval/route`) and any promotion of a version whose request expired or was refused; the loader refuses two routes for one scope or level and `owner` off a person route; the Cedar export takes the block and says in one header line that its routes are not exported.

**Why.** Card E2.19, step 2, and E2.14's finding that the consuming card decides the export's treatment.

**Result.** `load-options.test.ts` passes without the approval rows; the core policy and plane unit suites, 45 files, 1479 tests, pass.

**Consequence.** A policy without the block decides exactly as before.
