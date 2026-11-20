---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "make test"
  - "pnpm exec vitest run test/doctor-review.test.ts test/doctor.test.ts test/review-verification.test.ts (in packages/cli)"
  - "pnpm exec vitest run test/letta/commits.test.ts test/letta/repository.test.ts (in packages/adapters)"
  - "pnpm exec vitest run test/b3.test.ts test/lint-faults.test.ts (in packages/runner)"
supersedes: none
---

**What.** The second full `make test` failed 10 of 3,334 tests. Each failure was a timeout (30 s, and 300 s for B3's acceptance test). The suites were the CLI's doctor tests, the Letta adapter's commit tests, and the runner's B3 and lint-fault tests.

**Why.** The machine was running other agents' worktrees at the same time. None of these tests touches the files this card changed, and the first full run had passed all of them; its one failure was the server test fixed since.

**Result.** Rerun alone, the three groups pass: CLI 60, adapters 36, runner 25. pytest passes (258), and so does `make test-invariants` (6).

**Consequence.** This is load, not a regression. The lead may want the full suite rerun on a quiet machine before merging.
