---
date: 2026-11-21
author: claude-agent
type: change
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/src/lint/det.ts
  - packages/core/src/lint.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
  - "make test-one T=packages/core/test/unit/lint/near-duplicate.test.ts"
supersedes: none
---

**What.** Card L5 adds `near-duplicate-tier` to `DETERMINISTIC_LINT_IDS`: MinHash with a fixed seed for candidates, then a precision tier (IDF cosine, and vetoes on rare terms, numbers and polarity), run only when a policy lists the id.

**Why.** ADR 0018 promised a MinHash near-duplicate lint; card L1 built only the exact one, and on LongMemEval's memory the exact lint is the only deterministic lint that fires.

**Result.** 39 unit tests pass, among them claude-mem's ported cosine tests and golden vectors, an estimator check (bias under 0.012, error within 1.3 times sqrt(J(1-J)/128)) and a 10,000-item pass with 1,351 candidate pairs where all pairs would be 49,995,000, in about 1.4 seconds. Mutation checks: disabling the polarity veto fails the near-miss fixture; disabling the exact-copy skip fails three tests. Absorbed: claude-mem (Apache-2.0, port), codebase-memory-mcp (MIT, port), hermes-dreaming (MIT, idea).

**Consequence.** H3 can use the tier once card R2's arm P4 is registered.
