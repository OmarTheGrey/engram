---
date: 2026-11-28
author: claude-agent
type: change
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - packages/core/test/unit/plane/approvals-review.test.ts
  - packages/core/test/property/approvals.test.ts
  - "make test-one T=packages/core/test/unit/plane/approvals-review.test.ts"
supersedes: none
---

**What.** After card D5 merged, its safety-scan hold (a `gate` ask, so a request in the queue) is released only by an approver the target's route names when the policy has an approval block; anyone else is refused under `engram/approval/route` (review finding F5). `owner` on a person route is D5's own owner release.

**Why.** Without it, a reviewer ADR 0026 admits but the route does not name could release the hold, approving the request outside its route.

**Result.** Unit tests: an unrouted reviewer refused, a routed one releases and the request closes approved, no block as before; 17 passed. The tenth invariant gains held procedures in role:lead and role routes: 22 released landings. With the check removed, both files fail. D5's own file: 109 passed.

**Consequence.** Nothing changes without a block.
