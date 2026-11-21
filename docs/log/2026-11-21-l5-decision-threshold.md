---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/det.ts
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load.test.ts
supersedes: none
---

**What.** The tier flags on the MinHash estimate at the `near-duplicate` threshold, holds the IDF cosine to the same threshold, uses preset medium's 0.85 when a policy lists the tier and sets none, and the loader refuses a value outside (0, 1] only when the tier is listed.

**Why.** One knob keeps every number traceable to the policy; ADR 0018 and the card decide on the MinHash estimate. Judging the key only with the tier listed leaves the registered presets unjudged by a new rule.

**Result.** load.test.ts gains one test; its 50 tests pass. Cost if wrong: near-threshold pairs flip on estimator noise rather than the exact similarity.

**Consequence.** Nothing else.
