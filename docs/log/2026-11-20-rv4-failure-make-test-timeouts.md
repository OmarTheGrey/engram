---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/repository.test.ts
  - packages/runner/test/b3.test.ts
supersedes: none
---

**What.** The first `make test` on branch rv4 failed 4 of 3294 tests: three Letta tests (two 30 s timeouts, one EBUSY on a git lock) and runner B3 (its 300 s timeout).

**Why.** Machine load: the run took over five minutes per file. None of the four goes through adoption's changed paths.

**Result.** Rerun alone on the same commit: `pnpm exec vitest run --root packages/adapters test/letta/commits.test.ts test/letta/repository.test.ts test/conformance/conformance.test.ts` 235 passed, `pnpm exec vitest run --root packages/runner test/b3.test.ts` 11 passed. The other 3269 passed in the full run.

**Consequence.** None for the code.
